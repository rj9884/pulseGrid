package worker

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var (
	ProbesTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "pulsegrid_probes_total",
			Help: "Total number of executed health check probes",
		},
		[]string{"status"},
	)

	ProbeDurationSeconds = promauto.NewHistogram(
		prometheus.HistogramOpts{
			Name:    "pulsegrid_probe_duration_seconds",
			Help:    "Latency duration distribution of health probes",
			Buckets: []float64{0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0},
		},
	)

	QueueDepth = promauto.NewGauge(
		prometheus.GaugeOpts{
			Name: "pulsegrid_worker_queue_depth",
			Help: "Current depth of the probing worker jobs queue",
		},
	)
)
