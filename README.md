# Do Boy Barbearia — Netlify + Supabase

Versão adaptada para **Netlify** (frontend e serverless functions) e **Supabase** (Postgres e autenticação). A primeira foto do carrossel foi trocada pela foto enviada e está salva localmente em `public/assets/corte-platinado.jpg`.

## 1. Criar o banco de dados

1. No Supabase, crie um projeto.
2. Entre em **SQL Editor** > **New query**.
3. Cole TODO o conteúdo do arquivo `supabase.sql` e execute.
4. Em **Authentication > Providers > Email**, deixe o cadastro por e-mail ativo. Você pode exigir confirmação por e-mail (recomendado); configure os URLs permitidos em Authentication > URL Configuration.

A autenticação de clientes usa **Supabase Auth**, não senhas gravadas nas tabelas. O SQL também cria serviços, configurações, perfis, agendamentos e logs. A restrição de sobreposição impede que reservas confirmadas colidam (inclusive por concorrência).

## 2. Variáveis de ambiente da Netlify

Na Netlify, em **Project configuration > Environment variables**, adicione:

- `SUPABASE_URL`: Project URL do seu projeto Supabase.
- `SUPABASE_ANON_KEY`: chave pública anon / publishable **compatível com o Supabase Auth**.
- `SUPABASE_SERVICE_ROLE_KEY`: chave `service_role` secreta do Supabase.

**JAMAIS** coloque `SUPABASE_SERVICE_ROLE_KEY` em `public/`, no JavaScript do navegador ou em repositório público. Ela só é utilizada pela função em `netlify/functions/api.js`.

## 3. Hospedar na Netlify

1. Suba a pasta completa `do-boy-barbearia` para um repositório privado GitHub (recomendado).
2. Na Netlify, escolha **Add new project > Import an existing project** e conecte o repositório.
3. Build command: **(vazio)**; Publish directory: `public`; Functions directory: `netlify/functions`. O arquivo `netlify.toml` já possui essas definições e o roteamento `/api/*`.
4. Defina as 3 variáveis acima e use **Deploy**. A Netlify instala as dependências do `package.json` automaticamente.
5. Abra o site, cadastre-se com seu e-mail e confirme o endereço de e-mail caso esteja habilitado.

Para rodar localmente: `npm install` e `npx netlify dev`, com as variáveis definidas em um `.env` local (não publique `.env`).

## 4. Tornar seu usuário administrador

Depois de **criar sua conta no site**, volte ao SQL Editor do Supabase e execute, trocando o e-mail pelo seu:

```sql
update public.profiles set role = 'admin'
where id = (select id from auth.users where email = 'SEU_EMAIL@EXEMPLO.COM');
```

Saia e entre novamente. O painel de administração aparece na seção **Minha conta**. Nenhum usuário consegue se promover a admin por meio de um formulário do site.

## 5. Gerenciar o site

No painel, você pode configurar serviços e preços, dias e horários de funcionamento, endereço, Instagram, clientes, reservas e logs. O telefone é obrigatório no cadastro. O carrossel desliza automaticamente, sem setas/contador.

**Foto:** `public/assets/corte-platinado.jpg` é a nova foto usada na primeira posição do carrossel. Para usar outra, substitua esse arquivo mantendo o nome.

## 6. Segurança e observações

- As tabelas do Supabase estão com RLS habilitado e sem políticas públicas: acesso aos dados ocorre pelas funções Netlify, que conferem o usuário autenticado e a role de admin no servidor.
- Os tokens de sessão são mantidos no armazenamento local do navegador para compatibilidade com este frontend. Para segurança adicional em produção, recomenda-se migrar para sessão com cookies HttpOnly e configurar proteção antiabuso/captcha nas rotas de cadastro e login.
- Não há pagamento integrado, disparos de WhatsApp ou e-mail automático de agendamento. O valor no painel é o total *reservado*, não pagamentos recebidos.
- Agendamentos operam no fuso `America/Maceio` por padrão, alterável diretamente no campo `timezone` da tabela `shop_settings` no Supabase.
- A Netlify oferece hospedagem estática + funções. O `server.js` antigo de Node não é necessário nem incluído nesta versão.
- Cadastros e reservas só funcionam depois de aplicar o SQL e configurar as variáveis.

## Créditos no rodapé

Powered By Frio Mortal • FrioStore • HypeStore. Hospedagem: Netlify.


## Atualização: animações e demonstração interativa
- Página principal com serviços no lugar dos atalhos rápidos.
- Serviços são carregados do Supabase; valores no menu público vêm da configuração real.
- `public/demonstracao.html`: navegação interativa de página pública, cliente e administrador, **somente visual**. Não existem usuários de demonstração, credenciais predefinidas ou acesso de administrador sem autenticação.
- `public/demo.js`: dados fictícios exclusivamente locais à demonstração; nenhuma chamada de gravação à API.
- `public/motion.js`: progresso de rolagem e animações de entrada, respeitando a preferência de movimento reduzido.

A demonstração é acessível pelo botão **Ver demonstração**. Os preços e estatísticas dentro dela são apenas ilustrativos e não alteram o banco.
