package main

import (
	"errors"
	"flag"
	"fmt"
	"log"
	"os"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
)

func main() {
	var migrationsPath string
	var dbURL string

	flag.StringVar(&migrationsPath, "path", "./migrations", "Path to migrations folder")
	flag.StringVar(&dbURL, "db", "", "Database URL")
	flag.Parse()

	if dbURL == "" {
		dbURL = os.Getenv("DATABASE_URL")
		if dbURL == "" {
			dbURL = "postgres://pulsegrid:pulsegrid_secret@localhost:5432/pulsegrid_db?sslmode=disable"
		}
	}

	args := flag.Args()
	if len(args) == 0 {
		log.Fatal("migration direction required: up or down")
	}

	direction := args[0]
	m, err := migrate.New(fmt.Sprintf("file://%s", migrationsPath), dbURL)
	if err != nil {
		log.Fatalf("failed to initialize migrate: %v", err)
	}
	defer m.Close()

	switch direction {
	case "up":
		if err := m.Up(); err != nil && !errors.Is(err, migrate.ErrNoChange) {
			log.Fatalf("failed to run migrations up: %v", err)
		}
		log.Println("migrations up applied successfully")
	case "down":
		if err := m.Steps(-1); err != nil && !errors.Is(err, migrate.ErrNoChange) {
			log.Fatalf("failed to run migrations down: %v", err)
		}
		log.Println("migration down step applied successfully")
	default:
		log.Fatalf("unsupported migration direction: %s", direction)
	}
}
