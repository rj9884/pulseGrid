package worker

import (
	"context"
	"crypto/tls"
	"fmt"
	"io"
	"net/http"
	"net/http/httptrace"
	"time"

	"github.com/pulsegrid/backend/internal/domain"
	"github.com/pulsegrid/backend/pkg/security"
)

type ProbeResult struct {
	StatusCode   *int
	LatencyMS    int
	DNSMS        int
	ConnectMS    int
	TLSMS        int
	TTFBMS       int
	IsUp         bool
	ErrorMessage *string
}

type Prober struct {
	client               *http.Client
	allowPrivateNetworks bool
}

func NewProber(allowPrivateNetworks bool) *Prober {
	transport := &http.Transport{
		MaxIdleConns:        100,
		MaxIdleConnsPerHost: 10,
		IdleConnTimeout:     90 * time.Second,
		TLSHandshakeTimeout: 10 * time.Second,
		TLSClientConfig: &tls.Config{
			InsecureSkipVerify: false,
		},
	}

	return &Prober{
		client: &http.Client{
			Transport: transport,
		},
		allowPrivateNetworks: allowPrivateNetworks,
	}
}

func (p *Prober) Execute(ctx context.Context, job domain.MonitorJob) ProbeResult {
	if _, err := security.ValidateTargetURL(job.URL, p.allowPrivateNetworks); err != nil {
		errMsg := err.Error()
		return ProbeResult{
			IsUp:         false,
			ErrorMessage: &errMsg,
			ConnectMS:    0,
		}
	}

	timeout := time.Duration(job.TimeoutMS) * time.Millisecond
	if timeout <= 0 {
		timeout = 5 * time.Second
	}

	probeCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	var (
		dnsStart    time.Time
		dnsDone     time.Time
		connectStart time.Time
		connectDone  time.Time
		tlsStart    time.Time
		tlsDone     time.Time
		wroteReq    time.Time
		firstByte   time.Time
	)

	trace := &httptrace.ClientTrace{
		DNSStart: func(_ httptrace.DNSStartInfo) {
			dnsStart = time.Now()
		},
		DNSDone: func(_ httptrace.DNSDoneInfo) {
			dnsDone = time.Now()
		},
		ConnectStart: func(_, _ string) {
			connectStart = time.Now()
		},
		ConnectDone: func(_, _ string, _ error) {
			connectDone = time.Now()
		},
		TLSHandshakeStart: func() {
			tlsStart = time.Now()
		},
		TLSHandshakeDone: func(_ tls.ConnectionState, _ error) {
			tlsDone = time.Now()
		},
		WroteRequest: func(_ httptrace.WroteRequestInfo) {
			wroteReq = time.Now()
		},
		GotFirstResponseByte: func() {
			firstByte = time.Now()
		},
	}

	req, err := http.NewRequestWithContext(httptrace.WithClientTrace(probeCtx, trace), job.Method, job.URL, nil)
	if err != nil {
		errMsg := fmt.Sprintf("invalid probe request: %v", err)
		return ProbeResult{
			IsUp:         false,
			ErrorMessage: &errMsg,
			ConnectMS:    0,
		}
	}

	for k, v := range job.Headers {
		req.Header.Set(k, v)
	}
	if req.Header.Get("User-Agent") == "" {
		req.Header.Set("User-Agent", "PulseGrid-Probe/1.0 (+https://github.com/pulsegrid)")
	}

	reqStart := time.Now()
	resp, err := p.client.Do(req)
	totalLatency := time.Since(reqStart)

	if err != nil {
		errMsg := err.Error()
		return ProbeResult{
			LatencyMS:    int(totalLatency.Milliseconds()),
			IsUp:         false,
			ErrorMessage: &errMsg,
			ConnectMS:    0,
		}
	}
	defer resp.Body.Close()

	// Drain up to 64KB response body
	_, _ = io.CopyN(io.Discard, resp.Body, 64*1024)

	var (
		dnsMS     int
		connectMS int
		tlsMS     int
		ttfbMS    int
	)

	if !dnsStart.IsZero() && !dnsDone.IsZero() {
		dnsMS = int(dnsDone.Sub(dnsStart).Milliseconds())
	}
	if !connectStart.IsZero() && !connectDone.IsZero() {
		connectMS = int(connectDone.Sub(connectStart).Milliseconds())
	}
	if !tlsStart.IsZero() && !tlsDone.IsZero() {
		tlsMS = int(tlsDone.Sub(tlsStart).Milliseconds())
	}
	if !wroteReq.IsZero() && !firstByte.IsZero() {
		ttfbMS = int(firstByte.Sub(wroteReq).Milliseconds())
	}

	code := resp.StatusCode
	expectedCode := job.ExpectedStatus
	if expectedCode == 0 {
		expectedCode = 200
	}

	isUp := code == expectedCode
	var errMsg *string
	if !isUp {
		msg := fmt.Sprintf("expected status %d, got %d", expectedCode, code)
		errMsg = &msg
	}

	return ProbeResult{
		StatusCode:   &code,
		LatencyMS:    int(totalLatency.Milliseconds()),
		DNSMS:        dnsMS,
		ConnectMS:    connectMS,
		TLSMS:        tlsMS,
		TTFBMS:       ttfbMS,
		IsUp:         isUp,
		ErrorMessage: errMsg,
	}
}
