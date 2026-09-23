package httpapi

import (
	"mime"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strings"
)

// static serves the Vite build. Hashed assets are cached forever and served from
// their build-time .gz sibling when the browser accepts gzip.
type static struct {
	root  string
	files http.Handler
}

func newStatic(root string) http.Handler {
	return &static{root: root, files: http.FileServer(http.Dir(root))}
}

func (s *static) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	clean := path.Clean("/" + r.URL.Path)
	if strings.HasPrefix(clean, "/assets/") {
		w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
	} else {
		w.Header().Set("Cache-Control", "no-cache")
	}
	if strings.Contains(r.Header.Get("Accept-Encoding"), "gzip") && clean != "/" {
		compressed := filepath.Join(s.root, filepath.FromSlash(clean)+".gz")
		if info, err := os.Stat(compressed); err == nil && info.Mode().IsRegular() {
			if kind := mime.TypeByExtension(path.Ext(clean)); kind != "" {
				w.Header().Set("Content-Type", kind)
			}
			w.Header().Set("Content-Encoding", "gzip")
			w.Header().Add("Vary", "Accept-Encoding")
			http.ServeFile(w, r, compressed)
			return
		}
	}
	s.files.ServeHTTP(w, r)
}
