package files

// Topics published by the file service.
const (
	TopicSaved   = "files.saved"
	TopicCreated = "files.created"
	TopicDeleted = "files.deleted"
	TopicRenamed = "files.renamed"
)

var Topics = []string{TopicSaved, TopicCreated, TopicDeleted, TopicRenamed}

type Change struct {
	Path    string `json:"path"`
	OldPath string `json:"oldPath,omitempty"`
	Kind    string `json:"kind,omitempty"`
	Version string `json:"version,omitempty"`
}
