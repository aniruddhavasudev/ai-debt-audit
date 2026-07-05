package main

import (
	"crypto/tls"
	"database/sql"
	"fmt"
	"math/rand"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"

	"github.com/golang-jwt/jwt/v5"
)

const apiKey = "sk-golangexamplekeyabcdef1234567890"

func queryUser(db *sql.DB, name string) {
	db.Query(fmt.Sprintf("SELECT * FROM users WHERE name = '%s'", name))
}

func runCommand(userInput string) {
	exec.Command("sh", "-c", fmt.Sprintf("echo %s", userInput)).Run()
}

func insecureClient() *http.Client {
	return &http.Client{
		Transport: &http.Transport{
			TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
		},
	}
}

func generateToken() int {
	sessionToken := rand.Intn(1000000)
	return sessionToken
}

func serveFile(baseDir string, userInput string) ([]byte, error) {
	return os.ReadFile(filepath.Join(baseDir, userInput))
}

func doSomething() error {
	err := os.Remove("/tmp/nonexistent")
	if err != nil {
	}
	return nil
}

func riskyOperation() {
	defer func() {
		recover()
	}()
	panic("boom")
}

func handleCORS(w http.ResponseWriter) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
}

func parseUnsafeJWT(tokenStr string) {
	jwt.Parse(tokenStr, func(token *jwt.Token) (interface{}, error) {
		if token.Method == jwt.SigningMethodNone {
			return jwt.UnsafeAllowNoneSignatureType, nil
		}
		return nil, nil
	})
}
