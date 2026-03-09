# Deploy da aplicação vdyou no VPS (Docker)

Siga estes passos **no servidor Linux** (via SSH).

---

## 1. Conferir Docker

```bash
docker --version
docker compose version
```

Se não tiver instalado: `sudo apt update && sudo apt install -y docker.io docker-compose-plugin`.

---

## 2. Colocar o projeto no servidor

**Opção A – Clonar do Git (recomendado)**

```bash
cd ~
git clone https://github.com/SEU_USUARIO/easy-view-editor.git
cd easy-view-editor
```

(Substitua pela URL real do seu repositório.)

**Opção B – Enviar do seu PC**

No **seu Windows** (PowerShell), na pasta do projeto:

```powershell
scp -r . usuario@IP_DO_SERVIDOR:~/easy-view-editor
```

Ou use um cliente SFTP (FileZilla, WinSCP) para enviar a pasta do projeto para o home do usuário, por exemplo `~/easy-view-editor`.

---

## 3. Criar o arquivo `.env` no servidor

Na pasta do projeto no servidor (ex.: `~/easy-view-editor`):

```bash
cd ~/easy-view-editor   # ou o caminho onde está o projeto

nano .env
```

Conteúdo mínimo (ajuste com o **IP ou domínio do seu VPS**):

```env
VITE_API_URL=http://SEU_IP_AQUI:4000
VITE_FIREBASE_API_KEY=sua-api-key
VITE_FIREBASE_AUTH_DOMAIN=seu-projeto.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=seu-project-id
VITE_FIREBASE_STORAGE_BUCKET=seu-projeto.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=seu-sender-id
VITE_FIREBASE_APP_ID=seu-app-id
```

- Troque `SEU_IP_AQUI` pelo IP público do VPS (ex.: `123.45.67.89`).
- Se tiver domínio apontando para o servidor, pode usar `http://seudominio.com:4000`.

Salve: `Ctrl+O`, Enter, depois `Ctrl+X`.

---

## 4. Subir a aplicação com Docker

Na mesma pasta do projeto:

```bash
docker compose up -d --build
```

A primeira vez pode demorar (build da imagem e instalação de dependências).

---

## 5. Verificar se está rodando

```bash
docker compose ps
```

Deve aparecer o container `easyview` (ou o nome do serviço) em execução.

Acesso no navegador:

- **Frontend:** `http://SEU_IP:5173`
- **API:** `http://SEU_IP:4000`

---

## 6. Firewall (se o provedor usar)

Se não conseguir acessar 5173 ou 4000, abra as portas:

```bash
sudo ufw allow 5173
sudo ufw allow 4000
sudo ufw reload
```

(Se usar `ufw`. Em outros firewalls, o conceito é o mesmo: liberar 5173 e 4000.)

---

## Atualizar o projeto (git pull) sem perder o .env do servidor

O repositório **não** inclui `.env` nem a pasta `server/uploads` (estão no `.gitignore`). Para garantir que **as variáveis de configuração nunca são sobrescritas**, use no servidor o script **`update-on-server.sh`**.

### Forma recomendada (script que preserva o .env)

No VPS, na pasta do projeto:

```bash
chmod +x update-on-server.sh
./update-on-server.sh
```

O script:
1. Faz **backup** do `.env` do servidor
2. Executa **git pull**
3. **Restaura** o `.env` do backup (mesmo que algo o tivesse alterado)
4. Reconstrui e reinicia o Docker

Assim as variáveis de configuração (`.env`) **nunca** são substituídas.

### Se preferir fazer manualmente

- O repositório não inclui `.env` (está no `.gitignore`), por isso em condições normais `git pull` não o altera.
- Se um dia tiver commitado `.env` por engano, remova-o do Git no seu PC (uma vez):
  ```bash
  git rm --cached .env
  git commit -m "Deixar de versionar .env"
  git push
  ```
  E use sempre **`update-on-server.sh`** no servidor para ter a certeza de que o `.env` não é sobrescrito.

---

## Nginx (config fica fora do projeto)

A configuração do Nginx fica **no servidor**, em pastas do sistema (ex.: `/etc/nginx/sites-available/`), **não** na pasta do projeto. Por isso:

- **`git pull`** não altera o Nginx — podes atualizar o código à vontade.
- Para alterar o Nginx (domínio, timeouts, SSL, etc.), editas **no VPS** o ficheiro do teu site, por exemplo:
  ```bash
  sudo nano /etc/nginx/sites-available/vdyou
  ```
  Depois: `sudo nginx -t` e `sudo systemctl reload nginx`.

No repositório existe o ficheiro **`nginx-vdyou-example.conf`** só como **referência**. Quando precisares de ajustar o Nginx no servidor (por exemplo timeouts para a transcrição), podes copiar as linhas desse exemplo para o teu ficheiro em `/etc/nginx/sites-available/`.

---

## Comandos úteis

| Ação | Comando |
|------|--------|
| Ver logs | `docker compose logs -f` |
| Parar | `docker compose down` |
| Reiniciar | `docker compose restart` |
| Rebuild e subir de novo | `docker compose up -d --build` |

---

## Erro 413 (Request Entity Too Large) no upload

O Nginx limita o tamanho do corpo da requisição (padrão 1 MB). Para permitir vídeos grandes:

1. Edite o config do site:
   ```bash
   sudo nano /etc/nginx/sites-available/vdyou.com
   ```

2. No início do bloco `server {` (logo após `listen 80;` ou `listen 443 ssl;`), adicione:
   ```nginx
   client_max_body_size 500M;
   ```

3. Se a API estiver atrás do Nginx (ex.: `location /api/` com proxy para a 4000), esse mesmo bloco já vale. Salve (Ctrl+O, Enter, Ctrl+X).

4. Teste e recarregue o Nginx:
   ```bash
   sudo nginx -t
   sudo systemctl reload nginx
   ```

**Proxy da API no Nginx (recomendado):** para usar só `https://vdyou.com` (sem porta) e evitar 413, faça o Nginx encaminhar `/api` para a porta 4000 e permitir corpo grande:

No mesmo arquivo `/etc/nginx/sites-available/vdyou.com`, dentro do bloco `server { }`, além do `client_max_body_size 500M;` e do `location /` que já existe, adicione:

```nginx
    client_max_body_size 500M;

    location /api/ {
        proxy_pass http://127.0.0.1:4000/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 500M;
    }
```

No `.env` do servidor (pasta do projeto), use:
```env
VITE_API_URL=https://vdyou.com/api
PUBLIC_URL=https://vdyou.com/api
```
(sem barra no final em ambos; o backend usa `PUBLIC_URL` para montar as URLs dos arquivos retornados após upload.)

Depois: `sudo nginx -t`, `sudo systemctl reload nginx`, e no projeto `docker compose up -d --build` para o frontend pegar a nova URL. A partir daí os uploads vão em `https://vdyou.com/api/upload` e o Nginx encaminha para o Node na 4000 com limite de 500 MB.

---

## WebSocket / HMR (erro "[vite] failed to connect to websocket")

Se ao abrir o site no navegador aparecer erro de WebSocket no console, o Nginx precisa repassar a conexão WebSocket para o Vite (porta 5173).

No mesmo bloco `server` (HTTPS), no `location /` que faz `proxy_pass` para a 5173, use:

```nginx
    location / {
        proxy_pass http://127.0.0.1:5173;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 86400;
    }
```

Depois: `sudo nginx -t` e `sudo systemctl reload nginx`.

Se estiver rodando o **servidor de desenvolvimento** do Vite no VPS (e não o build estático), adicione no `.env` do servidor:

```env
VITE_HMR_HOST=vdyou.com
```

Assim o cliente do Vite tenta conectar o WebSocket em `wss://vdyou.com` em vez de `localhost:5173`. Em produção com build estático (`npm run build` + servir os arquivos) o HMR não é usado e esse erro não aparece.

---

## Atualizar o projeto depois

Se usar Git no servidor:

```bash
cd ~/easy-view-editor
git pull
docker compose up -d --build
```

Se enviar arquivos de novo (scp/SFTP), suba de novo na pasta do projeto e rode `docker compose up -d --build`.
