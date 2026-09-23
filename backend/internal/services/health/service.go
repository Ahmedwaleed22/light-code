package health

type Service struct{}

func New() *Service { return &Service{} }

func (*Service) Status() string { return "ok" }
