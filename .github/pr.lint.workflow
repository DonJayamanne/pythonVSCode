workflow "New workflow" {
  on = "push"
  resolves = ["GitHub Action for npm"]
}

action "GitHub Action for npm" {
  uses = "actions/npm@e7aaefe"
  secrets = ["GITHUB_TOKEN", "HELLO"]
}
