# TabMix — extensão 0.2.1

Temas Claro, Escuro e Automático (acompanha o sistema). Escolha em **Aparência**, no topo do painel. A preferência fica salva. Contraste, espaçamento, botões e indicação de captura foram revisados. O motor de áudio não foi alterado.

## Atualizar mantendo suas configurações

1. Pare a captura do TabMix e feche o painel.
2. Extraia este ZIP em uma pasta temporária.
3. Copie **o conteúdo da pasta extension** para dentro da **pasta extension antiga, que você já carregou no Edge**, substituindo os arquivos. Mantenha o mesmo caminho da instalação anterior.
4. Abra `edge://extensions` e clique em **Recarregar** no cartão do TabMix (seta circular).
5. Abra a guia da música, clique no ícone do TabMix e selecione o tema em Aparência.

Não remova a extensão para atualizar. Mantendo a pasta e a instalação existentes, as escolhas salvas de dispositivos e volumes permanecem. O tema é salvo separadamente e não altera a captura. A opção Automático segue a preferência de cores informada pelo navegador/sistema.

Para uma instalação nova, carregue a pasta extension em `edge://extensions` > Modo do desenvolvedor > Carregar sem compactação. Não abra popup.html diretamente. Veja README.md para permissões e áudio.

Validação: verificações do motor de áudio (7), sintaxe JavaScript e simulação da preferência de tema passaram. A renderização visual automatizada no Edge não pôde ser concluída neste ambiente.

Ícone personalizado aplicado na barra do navegador, na lista de extensões e no cabeçalho. Versão 0.2.1; áudio e permissões permanecem iguais.
