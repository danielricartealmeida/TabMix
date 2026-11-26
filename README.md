# TabMix — música + voz

Versão 1.0.0 estável. Uma extensão Manifest V3 captura **somente a guia em que você clicar**, mistura seu microfone e reproduz o resultado em um dispositivo de áudio virtual. Sem servidor, dependências npm ou aplicativo adicional do TabMix.

Deixei temas claro, escuro e automático, com preferência salva. Para atualizar sem perder as configurações, veja em [ATUALIZAR.md](ATUALIZAR.md).

## O que vem nesta versão

- Captura da guia escolhida pelo ícone da extensão; funciona com a guia em segundo plano.
- Seleção de microfone, saída da mistura e fone para retorno.
- Volumes independentes de microfone, música enviada, retorno e saída geral.
- Mute de voz e música enviados à chamada. O mute da música não silencia seu retorno pessoal.
- Ducking opcional: reduz a música em cerca de 12 dB durante a fala.
- Medidores de pico, compressor de saída para reduzir picos e ajustes salvos localmente.
- Captura continua ao fechar o painel; botão Parar encerra todas as trilhas e saídas.
- Ao fechar a guia capturada ou perder uma trilha, a sessão é encerrada.

## 1. Instalar a ponte para o Discord

O TabMix mistura o áudio, mas não instala nem cria um driver de microfone no Windows. Para o Discord desktop receber a mistura, instale um cabo virtual compatível, como o [VB-CABLE, do fabricante](https://vb-audio.com/Cable/).

Baixe do fabricante, extraia o ZIP, execute o instalador adequado ao seu Windows como administrador e reinicie conforme as instruções do fabricante. O driver não está incluído neste projeto. Se você já usa outro dispositivo virtual, pode selecioná-lo no lugar do VB-CABLE.

| Onde | Dispositivo |
| --- | --- |
| TabMix → Microfone | Seu microfone físico |
| TabMix → Enviar mistura para | CABLE Input (VB-Audio Virtual Cable) |
| TabMix → Ouvir música em | Seu fone físico |
| Discord → Dispositivo de entrada | CABLE Output (VB-Audio Virtual Cable) |
| Discord → Dispositivo de saída | Seu fone físico |

Os nomes Input/Output são do cabo: o mixer envia à entrada dele e o Discord recebe pela saída dele. **Não escolha CABLE Output como microfone do próprio TabMix**, pois isso cria realimentação. Não direcione a saída do Discord para o cabo nem torne o cabo a saída padrão do Windows: as vozes da call poderiam voltar para a chamada.

## 2. Carregar a extensão no Edge

1. Extraia este projeto para uma pasta fixa.
2. Abra `edge://extensions`.
3. Ative **Modo do desenvolvedor**.
4. Clique em **Carregar sem compactação** e selecione a pasta **extension**, onde está o `manifest.json`.
5. Fixe o TabMix na barra de extensões.
6. Abra o painel e clique em **Autorizar microfone e configurar**.
7. Na página aberta, clique em **Autorizar microfone** e permita o acesso solicitado pelo Edge.
8. Escolha seu microfone, **CABLE Input** para a mistura e seu fone para o retorno. As escolhas são salvas automaticamente.

É necessário um Edge atual com `tabCapture`, `offscreen` e seleção de dispositivo de saída. O projeto usa o modelo de captura de stream pelo service worker disponível no Chromium 116+. A compatibilidade real deve ser confirmada no Edge instalado.

## 3. Colocar a música na call

1. Abra o YouTube Music, escolha a playlist e dê play.
2. **Nessa mesma guia**, clique no ícone do TabMix e depois em **Capturar esta guia + voz**.
3. Confira o indicador **NO AR**, o nome da guia e os medidores.
4. No Discord, escolha **CABLE Output** como entrada.
5. Faça um teste com outra pessoa e comece com a música baixa. Os valores iniciais são voz 70%, música 15%, retorno 50% e saída 80%.
6. Feche o painel normalmente. A captura continua até você clicar em **Parar**, fechar a guia ou encerrar o navegador.

Para trocar de guia ou dispositivo, pare e inicie novamente. Ao recarregar a extensão em `edge://extensions`, a captura é encerrada e precisa ser iniciada de novo. Reabrir o navegador não inicia gravação automaticamente.

O Edge interrompe a reprodução normal de uma guia capturada. Por isso o TabMix oferece retorno próprio da música. Deixe o retorno ativado para continuar ouvindo; sem retorno, somente a mistura vai à saída escolhida. O volume do retorno é independente do volume da música enviada ao Discord.

## Ajustes e diagnóstico

- **O Discord corta a música:** experimente desativar a supressão de ruído/Krisp, controle automático de ganho e cancelamento de eco do Discord para essa entrada. Ajuste a sensibilidade manual se os trechos baixos forem cortados. Use fones. As opções e resultados dependem da versão do Discord e do seu equipamento.
- **Sem som no fone:** confirme Retorno ativado e escolha o fone físico explicitamente. Pare antes de mudar o destino.
- **Microfone não aparece:** use a página de configuração para autorizar, confira a permissão de microfone no Windows/Edge e clique em Atualizar dispositivos.
- **CABLE Input não aparece:** confirme a instalação do driver e reinicie o navegador/Windows conforme o fabricante orienta. O projeto não instala o driver.
- **Voz repetida/eco:** confira a tabela de roteamento. Não use a função Ouvir este dispositivo do Windows no cabo e não capture uma guia contendo a própria call.
- **Som distorcido:** reduza os canais e a saída geral. O compressor reduz picos, mas não é um limitador brickwall nem garantia contra qualquer saturação.
- **O mute do Discord silencia tudo:** esperado, porque música e voz chegam a ele como uma única entrada. Para silenciar apenas a voz, use o mute do microfone no TabMix.
- **Dispositivo USB/Bluetooth desconectou:** pare, atualize os dispositivos, selecione novamente e inicie. Mudanças de perfil Bluetooth podem reduzir a qualidade ou invalidar a seleção anterior.
- **Música sumiu após fechar a guia:** esperado; a captura pertence àquela guia. Abra outra e inicie nela.

## Privacidade e limites

Não há analytics, serviço remoto, scripts externos ou upload do áudio pelo TabMix. A extensão envia áudio apenas aos dispositivos escolhidos; o Discord transmite o que receber quando você entrar em uma chamada. As permissões são `tabCapture`, `offscreen`, `storage` e `activeTab`. O microfone só fica ativo na mistura depois de clicar em Iniciar, ou brevemente ao autorizar na configuração. Dispositivos e volumes ficam no armazenamento local da extensão.

O projeto não cria um microfone virtual próprio, não inclui driver, não oferece isolamento entre participantes e não muda as configurações do Discord automaticamente. Conteúdo protegido pode não permitir captura. A qualidade final também depende do processamento do Discord, da rede e do microfone. O ducking usa um limiar fixo de energia: ruído ou um microfone baixo podem exigir uma calibração futura.

## Desenvolvimento e validação

Sem etapa de build. Edite os arquivos e clique em Recarregar na página de extensões.

```powershell
node --test tests/engine.test.cjs
```

Os testes executam o motor com dispositivos/Web Audio simulados. Cobrem roteamento sem retorno de voz, parada/liberação de trilhas, falhas de permissão, saída inválida e encerramento da guia. Não substituem um teste físico de áudio nem medem latência ou qualidade sonora.

Checklist de aceitação no PC:

- [ ] Guia do YouTube Music + microfone chegam juntos à entrada de teste do Discord.
- [ ] Áudio de uma segunda guia e da saída do Discord não entram na mistura.
- [ ] Volumes, mute e ducking funcionam sem interromper a música.
- [ ] Retorno chega ao fone sem a voz e com volume independente.
- [ ] Fechar o painel mantém a captura.
- [ ] Parar, fechar a guia e desconectar o microfone liberam a sessão.
- [ ] Não há erro no service worker/documento offscreen em `edge://extensions`.

Arquivos: `background.js` coordena a captura; `offscreen.js` mantém o grafo de áudio; `popup.*` implementa controles e configuração; `style.css` contém a apresentação.

## Referências oficiais

- [APIs suportadas pelo Microsoft Edge](https://learn.microsoft.com/microsoft-edge/extensions/developer-guide/api-support)
- [tabCapture e preservação da reprodução local](https://developer.chrome.com/docs/extensions/reference/api/tabCapture)
- [Documentos offscreen](https://developer.chrome.com/docs/extensions/reference/api/offscreen)
- [VB-CABLE](https://vb-audio.com/Cable/)


Ícone personalizado aplicado na barra do navegador, na lista de extensões e no cabeçalho. Versão 0.2.1; áudio e permissões permanecem iguais.
