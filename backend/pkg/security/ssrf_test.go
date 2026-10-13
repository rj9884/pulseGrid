package security

import (
	"context"
	"net"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestValidateTargetURL(t *testing.T) {
	mockLookup := func(ctx context.Context, host string) ([]net.IP, error) {
		switch host {
		case "example.com":
			return []net.IP{net.ParseIP("93.184.216.34")}, nil
		case "127.0.0.1":
			return []net.IP{net.ParseIP("127.0.0.1")}, nil
		case "10.0.0.1":
			return []net.IP{net.ParseIP("10.0.0.1")}, nil
		case "169.254.169.254":
			return []net.IP{net.ParseIP("169.254.169.254")}, nil
		default:
			if ip := net.ParseIP(host); ip != nil {
				return []net.IP{ip}, nil
			}
			return net.DefaultResolver.LookupIP(ctx, "ip", host)
		}
	}

	tests := []struct {
		name         string
		url          string
		allowPrivate bool
		wantErr      bool
	}{
		{
			name:         "valid public https URL",
			url:          "https://example.com/health",
			allowPrivate: false,
			wantErr:      false,
		},
		{
			name:         "invalid protocol ftp",
			url:          "ftp://example.com/file",
			allowPrivate: false,
			wantErr:      true,
		},
		{
			name:         "empty url",
			url:          "",
			allowPrivate: false,
			wantErr:      true,
		},
		{
			name:         "loopback IP disallowed",
			url:          "http://127.0.0.1:8080/metrics",
			allowPrivate: false,
			wantErr:      true,
		},
		{
			name:         "private RFC1918 10.0.0.1 disallowed",
			url:          "http://10.0.0.1:8080/test",
			allowPrivate: false,
			wantErr:      true,
		},
		{
			name:         "cloud metadata IP 169.254.169.254 disallowed",
			url:          "http://169.254.169.254/latest/meta-data/",
			allowPrivate: false,
			wantErr:      true,
		},
		{
			name:         "loopback IP allowed when allowPrivate is true",
			url:          "http://127.0.0.1:8080/health",
			allowPrivate: true,
			wantErr:      false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			parsed, err := ValidateTargetURLWithLookup(tt.url, tt.allowPrivate, mockLookup)
			if tt.wantErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, parsed)
			}
		})
	}
}
