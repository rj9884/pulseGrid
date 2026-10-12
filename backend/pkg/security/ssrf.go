package security

import (
	"context"
	"fmt"
	"net"
	"net/url"
	"strings"
	"time"

	"github.com/pulsegrid/backend/internal/domain"
)

var blockedCIDRs []*net.IPNet

func init() {
	cidrs := []string{
		"127.0.0.0/8",       // IPv4 loopback
		"10.0.0.0/8",        // RFC1918
		"172.16.0.0/12",     // RFC1918
		"192.168.0.0/16",    // RFC1918
		"169.254.0.0/16",    // IPv4 link-local (cloud metadata 169.254.169.254)
		"0.0.0.0/8",         // Current network
		"100.64.0.0/10",     // Carrier-grade NAT
		"192.0.0.0/24",      // IETF Protocol Assignments
		"192.0.2.0/24",      // TEST-NET-1
		"198.51.100.0/24",   // TEST-NET-2
		"203.0.113.0/24",    // TEST-NET-3
		"224.0.0.0/4",       // Multicast
		"240.0.0.0/4",       // Reserved
		"::1/128",           // IPv6 loopback
		"fc00::/7",          // IPv6 unique local
		"fe80::/10",         // IPv6 link-local
	}

	for _, cidr := range cidrs {
		_, ipNet, err := net.ParseCIDR(cidr)
		if err == nil {
			blockedCIDRs = append(blockedCIDRs, ipNet)
		}
	}
}

type IPLookupFunc func(ctx context.Context, host string) ([]net.IP, error)

var defaultLookup IPLookupFunc = func(ctx context.Context, host string) ([]net.IP, error) {
	return net.DefaultResolver.LookupIP(ctx, "ip", host)
}

func ValidateTargetURL(rawURL string, allowPrivate bool) (*url.URL, error) {
	return ValidateTargetURLWithLookup(rawURL, allowPrivate, defaultLookup)
}

func ValidateTargetURLWithLookup(rawURL string, allowPrivate bool, lookup IPLookupFunc) (*url.URL, error) {
	parsed, err := url.ParseRequestURI(rawURL)
	if err != nil {
		return nil, fmt.Errorf("invalid URL structure: %w", err)
	}

	scheme := strings.ToLower(parsed.Scheme)
	if scheme != "http" && scheme != "https" {
		return nil, fmt.Errorf("invalid URL scheme %q: only http and https are permitted", parsed.Scheme)
	}

	hostname := parsed.Hostname()
	if hostname == "" {
		return nil, fmt.Errorf("URL missing valid host")
	}

	if allowPrivate {
		return parsed, nil
	}

	if lookup == nil {
		lookup = defaultLookup
	}

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	ips, err := lookup(ctx, hostname)
	if err != nil {
		return nil, fmt.Errorf("failed to resolve host %s: %w", hostname, err)
	}

	if len(ips) == 0 {
		return nil, fmt.Errorf("no IP addresses resolved for host %s", hostname)
	}

	for _, ip := range ips {
		if isBlockedIP(ip) {
			return nil, fmt.Errorf("%w: %s resolves to restricted IP %s", domain.ErrSSRFDetected, hostname, ip.String())
		}
	}

	return parsed, nil
}

func isBlockedIP(ip net.IP) bool {
	if ip.IsLoopback() || ip.IsPrivate() || ip.IsLinkLocalUnicast() || ip.IsLinkLocalMulticast() || ip.IsUnspecified() {
		return true
	}

	for _, blocked := range blockedCIDRs {
		if blocked.Contains(ip) {
			return true
		}
	}

	return false
}
