# Staging na EC2

Passo a passo humano, uma vez só. Depois disso, o deploy é `scripts/deploy-staging.sh`.

1. EC2 Ubuntu 24.04, `t3.medium` (o build do Next no servidor precisa de memória; se estourar, adicione swap), disco de 30 GB e Elastic IP.
2. Security group: porta 22 só dos IPs do time, 80 e 443 abertas.
3. Instale o Docker Engine e o plugin do Compose.
4. Crie uma deploy key só de leitura do `eteg/argos` e clone em `/opt/argos`.
5. Copie `infra/staging/.env.example` pra `/opt/argos/infra/staging/.env`, `chmod 600`, e preencha. `NEXT_PUBLIC_API_KEY` é igual a `API_KEY` e vai pro JavaScript público da web (D07), então não reaproveite a chave em outro ambiente.
6. DNS: registro A do subdomínio de staging pro Elastic IP. Sem subdomínio, use `<ip-com-traços>.sslip.io` em `STAGING_DOMAIN`.
7. AWS Budgets com alerta mensal pro time.
8. De uma máquina com acesso SSH: `STAGING_HOST=ubuntu@<ip> STAGING_DOMAIN=<domínio> scripts/deploy-staging.sh`.
