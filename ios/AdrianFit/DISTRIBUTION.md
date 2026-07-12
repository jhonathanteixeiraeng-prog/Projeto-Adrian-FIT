# Distribuição iOS — Adrian Fit

## Configuração do aplicativo

- Nome: Adrian Fit
- Bundle ID: `com.adriansantos.fit`
- Versão: `1.0.0`
- Build: `1`
- iOS mínimo: 17.0
- Dispositivo: iPhone
- Orientação: retrato
- Assinatura: automática
- Team ID: `8LC38UCNVW`
- Criptografia não isenta: não
- Privacy Manifest: incluído
- App Icon 1024 × 1024: incluído

## Gerar Archive

1. Abra Xcode → Settings → Accounts e adicione a conta Apple Developer.
2. Confirme que a equipe `8LC38UCNVW` aparece e que a assinatura automática está ativa.
3. Execute:

```bash
xcodebuild -project AdrianFit.xcodeproj \
  -scheme AdrianFit \
  -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath /tmp/AdrianFit.xcarchive \
  archive -allowProvisioningUpdates
```

## Enviar ao TestFlight

Pelo Xcode Organizer, selecione o Archive e use `Distribute App → App Store Connect → Upload`.

Antes do envio, preencher no App Store Connect:

- política de privacidade;
- URL de suporte;
- descrição, categoria e palavras-chave;
- classificação etária;
- questionário de privacidade;
- capturas de tela de iPhone;
- informações de contato para revisão;
- conta de demonstração para a equipe de revisão.
