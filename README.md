# 🎲 Dominó dos Números Racionais

Jogo educativo para estudantes de aproximadamente 12 a 14 anos praticarem equivalência entre **frações** e **números decimais**.

## Objetivo pedagógico

As metades das peças podem representar o mesmo número racional de formas diferentes. Exemplo:

- `3/4` ↔ `0,75`
- `17/25` ↔ `0,68`
- `13/20` ↔ `0,65`

O aluno precisa reconhecer a equivalência numérica para escolher onde encaixar uma peça.

## Arquitetura

- **GitHub Pages**: hospeda HTML/CSS/JavaScript de forma estática.
- **Firebase Authentication (anônimo)**: cria uma identidade técnica temporária para cada navegador, sem pedir cadastro ao aluno.
- **Firebase Realtime Database**: mantém a sala e o estado da partida sincronizados entre dois aparelhos.
- **Transactions do Realtime Database**: evitam que cliques simultâneos corrompam a vez ou a mesa.

Não há mais dependência de uma conexão WebRTC direta entre os celulares.

## Estrutura

```text
.
├── index.html
├── css/
│   └── styles.css
├── js/
│   ├── app.js                # interface e eventos
│   ├── domino-data.js        # valores racionais e 28 peças
│   ├── game-logic.js         # regras matemáticas puras
│   ├── firebase-service.js   # criação/entrada/sincronização de salas
│   ├── firebase-config.js    # configuração pública do projeto Firebase
│   └── demo-service.js       # teste local sem rede
├── firebase.rules.json       # regras recomendadas para o Realtime Database
└── .github/workflows/pages.yml
```

## Configuração do Firebase

1. Crie um projeto em https://console.firebase.google.com/
2. Adicione um **Web App** ao projeto.
3. Em **Authentication > Sign-in method**, habilite **Anonymous**.
4. Em **Realtime Database**, crie o banco.
5. Substitua as regras do banco pelo conteúdo de `firebase.rules.json`.
6. Em **Project settings > Your apps**, copie o objeto `firebaseConfig`.
7. Substitua os placeholders em `js/firebase-config.js`.

> O objeto `firebaseConfig` de um app Web é público por natureza. Não coloque senhas, service account ou chaves administrativas no repositório.

## Regras do jogo

- 28 peças; 14 para cada jogador.
- 2 jogadores por sala.
- A primeira peça é livre.
- Depois, a ponta deve ter valor matemático equivalente à ponta da mesa.
- O botão **Passar a vez** só aparece quando não existe jogada legal.
- Duas passagens consecutivas encerram uma partida bloqueada.
- Em bloqueio: vence quem tiver menos peças; persistindo empate, vence quem tiver menor soma dos valores das peças; se ainda empatar, a partida fica empatada.

## Publicação no GitHub Pages

O workflow `.github/workflows/pages.yml` está pronto. No GitHub, abra:

**Settings > Pages > Build and deployment > Source > GitHub Actions**

Depois de habilitar a fonte, qualquer push em `main` publica automaticamente o site.

## Manutenção

As funções de regra foram separadas da interface para facilitar alterações futuras. Comentários no código explicam os pontos principais de sincronização e validação.
