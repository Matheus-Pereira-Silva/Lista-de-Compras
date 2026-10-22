# Hosting — página de convite + verificação de domínio

## Status atual
- Publicado em `https://listacompras-c4c86.web.app`.
- `sha256_cert_fingerprints` verificado contra o certificado real do build
  `preview` do EAS (extraído do `.apk`, não só copiado de algum lugar) —
  confirmado em 22/10/2026: `03:4A:B4:19:CE:8E:58:59:85:C0:C4:9A:6D:3B:0A:D1:2D:F3:E6:E0:92:9B:FC:B3:54:24:7E:14:F0:36:D0:EF`.
- Isso cobre os builds **development** e **preview** (ambos usam o mesmo
  keystore remoto gerenciado pela Expo). Um build **production** feito
  localmente ou com outro keystore teria um SHA-256 diferente — se isso
  acontecer, repita a extração e atualize a lista abaixo.

## Páginas publicadas
- `convite/index.html` — recebida pelos links de convite (`/convite/{codigo}`).
- `excluir-conta.html` — instruções para pedir exclusão de conta sem o app (link exigido na ficha da Play Store).
- `privacidade.html` — política de privacidade (link exigido na ficha da Play Store).

## `convite/index.html`
Página servida pra qualquer URL `/convite/{codigo}` (ver rewrite em `firebase.json`). Lê o código direto do caminho da URL, mostra em destaque e oferece "Abrir no app" (link `listacompras://convite/{codigo}`) e "Baixar na Play Store".

O botão "Baixar na Play Store" está com link placeholder (`LINK_PLAY_STORE = '#'` no `<script>` do arquivo). **Depois de publicar o app na Play Store**, troque esse valor pelo link real (`https://play.google.com/store/apps/details?id=com.prismastudio.listacompras`).

## `.well-known/assetlinks.json`
Verificação do Digital Asset Links, necessária pro Android confiar no link `https://listacompras-c4c86.web.app/convite/...` e abrir o app direto (em vez do navegador), via `autoVerify` no `intentFilters` do `app.config.js`.

O `sha256_cert_fingerprints` atual é do certificado de assinatura usado nos builds **development/preview** do EAS (keystore gerenciado pela Expo, gerado automaticamente no primeiro build).

**Pendência**: quando a Play Store assinar o app pra produção (Play App Signing), ela usa um certificado **diferente** do keystore de upload do EAS. Depois de publicar a primeira versão lá, pegue o SHA-256 em:

> Play Console → seu app → Configuração → Integridade do app → "Certificado de assinatura do app"

e **adicione** esse valor como um segundo item no array `sha256_cert_fingerprints` (não precisa remover o atual — pode manter os dois, um por linha, pra cobrir tanto os builds internos quanto o app da loja).

### Passo a passo pra atualizar depois da publicação
1. Edite `hosting/.well-known/assetlinks.json`, acrescentando o novo SHA-256 no array (formato `AA:BB:CC:...`, com dois-pontos, maiúsculo).
2. Troque `LINK_PLAY_STORE` em `hosting/convite/index.html` pelo link real da loja.
3. Rode `firebase deploy --only hosting` de novo pra publicar as duas mudanças.
4. Confira com `curl -s https://listacompras-c4c86.web.app/.well-known/assetlinks.json` que o novo valor está lá.
