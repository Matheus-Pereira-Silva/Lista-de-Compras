# Hosting — página de convite + verificação de domínio

## `convite/index.html`
Página servida pra qualquer URL `/convite/{codigo}` (ver rewrite em `firebase.json`). Lê o código direto do caminho da URL, mostra em destaque e oferece "Abrir no app" (link `listacompras://convite/{codigo}`) e "Baixar na Play Store".

O botão "Baixar na Play Store" está com link placeholder (`LINK_PLAY_STORE = '#'` no `<script>` do arquivo). **Depois de publicar o app na Play Store**, troque esse valor pelo link real (`https://play.google.com/store/apps/details?id=com.prismastudio.listacompras`).

## `.well-known/assetlinks.json`
Verificação do Digital Asset Links, necessária pro Android confiar no link `https://listacompras-c4c86.web.app/convite/...` e abrir o app direto (em vez do navegador), via `autoVerify` no `intentFilters` do `app.config.js`.

O `sha256_cert_fingerprints` atual é do certificado de assinatura usado nos builds **development/preview** do EAS (keystore gerenciado pela Expo, gerado automaticamente no primeiro build).

**Pendência**: quando a Play Store assinar o app pra produção (Play App Signing), ela usa um certificado **diferente** do keystore de upload do EAS. Depois de publicar a primeira versão lá, pegue o SHA-256 em:

> Play Console → seu app → Configuração → Integridade do app → "Certificado de assinatura do app"

e **adicione** esse valor como um segundo item no array `sha256_cert_fingerprints` (não precisa remover o atual — pode manter os dois, um por linha, pra cobrir tanto os builds internos quanto o app da loja).
