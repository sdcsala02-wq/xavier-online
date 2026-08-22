$ErrorActionPreference = "Stop"

$CHAVE_ESPERADA = "XAVIER-ONLINE-2027-5H1-871DC3C-20260821"
$BRANCH_ESPERADA = "feature/xavier-2027-consolidacao-20260821"
$REMOTO_ESPERADO = "https://github.com/sdcsala02-wq/xavier-online.git"
$COMMIT_ANCORA = "871dc3c"

$RAIZ = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -LiteralPath $RAIZ

if (-not (Test-Path -LiteralPath ".git" -PathType Container)) {
    throw "BLOQUEADO: esta pasta não contém o repositório Git esperado."
}

if (-not (Test-Path -LiteralPath ".xavier-project-key.json" -PathType Leaf)) {
    throw "BLOQUEADO: chave de identidade do Xavier Online não encontrada."
}

$IDENTIDADE = Get-Content -LiteralPath ".xavier-project-key.json" -Raw |
    ConvertFrom-Json

if ($IDENTIDADE.chave -ne $CHAVE_ESPERADA) {
    throw "BLOQUEADO: a chave pertence a outro projeto ou está inválida."
}

$BRANCH_ATUAL = git branch --show-current

if ($LASTEXITCODE -ne 0) {
    throw "BLOQUEADO: não foi possível consultar a branch."
}

if ($BRANCH_ATUAL -ne $BRANCH_ESPERADA) {
    throw "BLOQUEADO: branch incorreta. Atual: $BRANCH_ATUAL | Esperada: $BRANCH_ESPERADA"
}

$REMOTO_ATUAL = git remote get-url origin

if ($LASTEXITCODE -ne 0 -or $REMOTO_ATUAL.Trim() -ne $REMOTO_ESPERADO) {
    throw "BLOQUEADO: repositório remoto diferente do Xavier Online oficial."
}

git merge-base --is-ancestor $COMMIT_ANCORA HEAD

if ($LASTEXITCODE -ne 0) {
    throw "BLOQUEADO: o histórico não contém o commit-âncora $COMMIT_ANCORA."
}

$HEAD = git rev-parse --short HEAD

Write-Host ""
Write-Host "PROJETO XAVIER ONLINE CONFIRMADO" -ForegroundColor Green
Write-Host "Caminho: $RAIZ"
Write-Host "Branch: $BRANCH_ATUAL"
Write-Host "Commit atual: $HEAD"
Write-Host "Chave: $CHAVE_ESPERADA"
Write-Host ""
Write-Host "Autorizado para continuar." -ForegroundColor Green
