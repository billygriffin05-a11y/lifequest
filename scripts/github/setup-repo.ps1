# Creates the PRIVATE GitHub repository, pushes main + dev, and protects main.
# Prerequisite: `gh auth login` (you sign in yourself in the browser).
#
# Usage: .\scripts\github\setup-repo.ps1 [-Name lifequest]
param([string]$Name = "lifequest")
$ErrorActionPreference = "Stop"

gh auth status | Out-Null
$Owner = gh api user --jq .login

if (-not ((git remote) -contains "origin")) {
  gh repo create "$Owner/$Name" --private --source . --remote origin --description "LIFEQUEST - local-first life RPG"
}
git push -u origin main
git push -u origin dev
gh repo edit "$Owner/$Name" --default-branch dev --delete-branch-on-merge --enable-auto-merge=false

# Branch protection for main: PR required, CI must pass, no force pushes.
$protection = @{
  required_status_checks = @{
    strict = $true
    contexts = @("Lint, types, unit/integration tests, build, e2e", "Dependency & secret checks")
  }
  enforce_admins = $false
  required_pull_request_reviews = @{ required_approving_review_count = 0 }
  restrictions = $null
  allow_force_pushes = $false
  allow_deletions = $false
  required_linear_history = $true
} | ConvertTo-Json -Depth 5
$protection | gh api -X PUT "repos/$Owner/$Name/branches/main/protection" --input - | Out-Null
$mainProtected = ($LASTEXITCODE -eq 0)

# Lighter protection for dev: CI must pass, no force pushes.
$devProtection = @{
  required_status_checks = @{ strict = $false; contexts = @("Lint, types, unit/integration tests, build, e2e") }
  enforce_admins = $false
  required_pull_request_reviews = $null
  restrictions = $null
  allow_force_pushes = $false
  allow_deletions = $false
} | ConvertTo-Json -Depth 5
$devProtection | gh api -X PUT "repos/$Owner/$Name/branches/dev/protection" --input - | Out-Null

# Dependabot vulnerability alerts (secret scanning runs in CI via gitleaks).
gh api -X PUT "repos/$Owner/$Name/vulnerability-alerts" | Out-Null
if ($mainProtected) {
  Write-Host "Done: https://github.com/$Owner/$Name (main protected, dev default)."
} else {
  Write-Warning "Repo pushed, but branch protection was NOT applied. Private repos need GitHub Pro (or a public repo) for protected branches."
  Write-Host "Repo: https://github.com/$Owner/$Name (dev default)."
}
