"""
Processa o CSV bruto gerado pelo google-maps-scraper.exe:
- filtra empresas com nota >= NOTA_MINIMA e sem site cadastrado
- gera o link do WhatsApp a partir do telefone
- salva tudo num banco local (leads.db) pra nunca repetir o mesmo lead em buscas futuras
- exporta um CSV só com os leads NOVOS de hoje, pronto pra abrir no Excel

Uso:
    py processar.py saidas\bruto.csv [queries.txt]
"""

import csv
import logging
import re
import sqlite3
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date, datetime
from pathlib import Path
from urllib.parse import urlparse

logger = logging.getLogger(__name__)

NOTA_MINIMA = 4.0
PASTA_SAIDAS = Path(__file__).parent / "saidas"
CAMINHO_BANCO = Path(__file__).parent / "leads.db"
VERIFICACOES_PARALELAS = 6
CAMINHO_QUERIES_PADRAO = Path(__file__).parent / "queries.txt"
LINHAS_POR_COMMIT = 20

# Domínios que NÃO contam como "site próprio da empresa" quando aparecem numa busca
# (redes sociais, marketplaces/agregadores de imóveis, diretórios, órgãos públicos etc.)
DOMINIOS_IGNORADOS = {
    "facebook.com", "instagram.com", "linkedin.com", "twitter.com", "x.com",
    "youtube.com", "tiktok.com",
    "olx.com.br", "vivareal.com.br", "zapimoveis.com.br", "imovelweb.com.br",
    "chavesnamao.com.br", "quintoandar.com.br", "nestoria.com.br",
    "empresas.serasaexperian.com.br", "econodata.com.br", "cnpj.biz",
    "google.com", "google.com.br", "maps.google.com",
    "wikipedia.org", "linktr.ee",
}


def dominio_e_proprio(url):
    """True se a URL parece ser o site oficial da própria empresa (não rede social/agregador)."""
    if not url:
        return False

    try:
        host = urlparse(url).netloc.lower()
    except ValueError:
        return False

    host = host.removeprefix("www.")
    if not host:
        return False

    # bate tanto o domínio exato ("facebook.com") quanto qualquer subdomínio dele
    # ("blog.facebook.com", "m.facebook.com") - antes só pegava a igualdade exata
    return not any(host == ignorado or host.endswith("." + ignorado) for ignorado in DOMINIOS_IGNORADOS)


BUSCA_BACKENDS = "duckduckgo,bing,yahoo"
BUSCA_TIMEOUT_SEGUNDOS = 3


def buscar_site_da_empresa(nome, cidade_ou_endereco=""):
    """
    Busca se a empresa já tem site próprio (mesmo que o Google Maps não tenha esse
    campo preenchido). Retorna a URL encontrada, ou None se não achar nenhum site
    que pareça ser da própria empresa.

    Usa backend fixo (duckduckgo,bing,yahoo) em vez do padrão "auto" da lib ddgs,
    que tenta até 9 provedores diferentes (Wikipedia, Grokipedia, Mojeek, Google,
    Brave, Startpage...) e deixava cada verificação levar 5-15s. Com poucos
    backends rápidos e um timeout curto, cada verificação cai pra ~1-2s.
    """
    try:
        from ddgs import DDGS
    except ImportError:
        return None

    consulta = f"{nome} {cidade_ou_endereco} site oficial".strip()

    try:
        resultados = DDGS(timeout=BUSCA_TIMEOUT_SEGUNDOS).text(
            consulta, max_results=5, region="br-pt", backend=BUSCA_BACKENDS
        )
    except Exception:
        return None  # falha na busca não deve travar o processamento do lead

    for resultado in resultados:
        url = resultado.get("href")
        if url and dominio_e_proprio(url):
            return url

    return None

# DDDs que precisam do "9" extra na frente do número local (regra do WhatsApp/E.164 para o Brasil)
DDDS_COM_NOVE = {"11", "12", "13", "14", "15", "16", "17", "18", "19", "21", "22", "24", "27", "28"}


def preparar_banco(conexao):
    conexao.execute(
        """
        CREATE TABLE IF NOT EXISTS leads (
            place_id TEXT PRIMARY KEY,
            nome TEXT,
            categoria TEXT,
            endereco TEXT,
            nota REAL,
            num_avaliacoes INTEGER,
            whatsapp_link TEXT,
            telefone TEXT,
            query_origem TEXT,
            status TEXT DEFAULT 'novo',
            observacoes TEXT,
            mensagem_gerada TEXT,
            visto_em TEXT,
            atualizado_em TEXT
        )
        """
    )
    conexao.commit()
    migrar_banco(conexao)


def migrar_banco(conexao):
    """Migrações aditivas do schema - roda toda vez que o banco é aberto, é seguro
    rodar múltiplas vezes (idempotente). Nunca recria/apaga tabelas ou dados existentes."""
    # usa índice numérico (não depende do row_factory configurado na conexão do chamador)
    colunas_existentes = {linha[1] for linha in conexao.execute("PRAGMA table_info(leads)")}

    novas_colunas = {
        "tags": "TEXT",
        "proximo_followup": "TEXT",
        "nicho": "TEXT",
        "cidade": "TEXT",
        "follow_ups_enviados": "INTEGER NOT NULL DEFAULT 0",
        "ultimo_followup_em": "TEXT",
    }
    for nome, tipo in novas_colunas.items():
        if nome not in colunas_existentes:
            conexao.execute(f"ALTER TABLE leads ADD COLUMN {nome} {tipo}")

    conexao.execute(
        """
        CREATE TABLE IF NOT EXISTS historico_status (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            place_id TEXT NOT NULL,
            status_anterior TEXT,
            status_novo TEXT NOT NULL,
            alterado_em TEXT NOT NULL
        )
        """
    )

    conexao.execute(
        """
        CREATE TABLE IF NOT EXISTS instagram_posts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            post_url TEXT NOT NULL,
            criado_em TEXT NOT NULL,
            etapa TEXT NOT NULL DEFAULT 'pendente',
            total_comentarios INTEGER,
            total_perfis INTEGER,
            erro_mensagem TEXT
        )
        """
    )

    conexao.execute(
        """
        CREATE TABLE IF NOT EXISTS instagram_leads (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            post_id INTEGER NOT NULL REFERENCES instagram_posts(id),
            username TEXT NOT NULL,
            full_name TEXT,
            is_private INTEGER,
            biography TEXT,
            seguidores INTEGER,
            is_business_account INTEGER,
            comentarios TEXT,
            prioridade TEXT,
            justificativa TEXT,
            sugestao_dm TEXT,
            atualizado_em TEXT
        )
        """
    )

    colunas_instagram_leads = {
        linha[1] for linha in conexao.execute("PRAGMA table_info(instagram_leads)")
    }
    novas_colunas_instagram_leads = {
        "status": "TEXT DEFAULT 'novo'",
        "nicho": "TEXT",
        "observacoes": "TEXT",
        "tags": "TEXT",
        "proximo_followup": "TEXT",
        "follow_ups_enviados": "INTEGER NOT NULL DEFAULT 0",
        "ultimo_followup_em": "TEXT",
    }
    for nome, tipo in novas_colunas_instagram_leads.items():
        if nome not in colunas_instagram_leads:
            conexao.execute(f"ALTER TABLE instagram_leads ADD COLUMN {nome} {tipo}")

    colunas_instagram_posts = {
        linha[1] for linha in conexao.execute("PRAGMA table_info(instagram_posts)")
    }
    if "nicho_alvo" not in colunas_instagram_posts:
        conexao.execute("ALTER TABLE instagram_posts ADD COLUMN nicho_alvo TEXT")
    if "arquivado_em" not in colunas_instagram_posts:
        conexao.execute("ALTER TABLE instagram_posts ADD COLUMN arquivado_em TEXT")

    conexao.execute(
        """
        CREATE TABLE IF NOT EXISTS historico_status_instagram (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            lead_id INTEGER NOT NULL,
            status_anterior TEXT,
            status_novo TEXT NOT NULL,
            alterado_em TEXT NOT NULL
        )
        """
    )

    conexao.execute(
        """
        CREATE TABLE IF NOT EXISTS templates_mensagem (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            titulo TEXT NOT NULL,
            texto TEXT NOT NULL,
            nicho TEXT,
            vezes_usado INTEGER NOT NULL DEFAULT 0,
            criado_em TEXT NOT NULL,
            atualizado_em TEXT NOT NULL
        )
        """
    )

    conexao.execute(
        """
        CREATE TABLE IF NOT EXISTS configuracoes (
            chave TEXT PRIMARY KEY,
            valor TEXT,
            atualizado_em TEXT
        )
        """
    )
    conexao.commit()

    _preencher_nicho_e_cidade_faltantes(conexao)
    _marcar_leads_instagram_ja_contatados(conexao)


USERNAMES_INSTAGRAM_JA_CONTATADOS = [
    "mariabavia.adv",
    "dr_viniciusferreira",
    "dr_polianoventurim",
    "ellenmorello",
]


def _marcar_leads_instagram_ja_contatados(conexao):
    """Backfill único: os 4 primeiros leads do Instagram que o Fernando já
    contatou manualmente (fora da ferramenta) antes do funil de status existir.
    Idempotente: só atualiza quem ainda está com status 'novo' ou nulo, então
    não sobrescreve um avanço de status feito depois pela interface."""
    placeholders = ",".join("?" for _ in USERNAMES_INSTAGRAM_JA_CONTATADOS)
    conexao.execute(
        f"""
        UPDATE instagram_leads
        SET status = 'contatado'
        WHERE username IN ({placeholders})
          AND (status IS NULL OR status = 'novo')
        """,
        USERNAMES_INSTAGRAM_JA_CONTATADOS,
    )
    conexao.commit()


def extrair_nicho_e_cidade(query_origem):
    """Separa uma query de busca ("clínica de estética em Londrina") em nicho
    ("clínica de estética") e cidade ("Londrina"). Usa a ÚLTIMA ocorrência de
    " em " como separador (mais seguro que a primeira, caso o nome do nicho
    contenha "em" no meio). Se não achar o padrão, devolve a query inteira como
    nicho e cidade vazia - nunca perde informação."""
    texto = (query_origem or "").strip()
    if not texto:
        return "", ""

    indice = texto.rfind(" em ")
    if indice == -1:
        return texto, ""

    nicho = texto[:indice].strip()
    cidade = texto[indice + len(" em "):].strip()
    return nicho, cidade


def _preencher_nicho_e_cidade_faltantes(conexao):
    """Backfill: para leads antigos que só têm query_origem preenchido (antes das
    colunas nicho/cidade existirem), extrai e preenche as duas colunas novas."""
    linhas = conexao.execute(
        "SELECT place_id, query_origem FROM leads WHERE (nicho IS NULL OR nicho = '') AND query_origem != ''"
    ).fetchall()
    for place_id, query_origem in linhas:
        nicho, cidade = extrair_nicho_e_cidade(query_origem)
        conexao.execute(
            "UPDATE leads SET nicho = ?, cidade = ? WHERE place_id = ?",
            (nicho, cidade, place_id),
        )
    if linhas:
        conexao.commit()


def telefone_limpo(telefone_bruto):
    """Só os dígitos do telefone, sem formatação - pra exibir/copiar na interface."""
    return re.sub(r"\D", "", telefone_bruto or "") or None


def mapear_queries_por_input_id(caminho_csv_bruto, caminho_queries):
    """
    O scraper não grava o texto da query no CSV, só um 'input_id' (um UUID por busca).
    Como cada busca do queries.txt vira exatamente um input_id, associamos pela ordem
    de aparição no CSV com a ordem das linhas do queries.txt.
    """
    if not caminho_queries or not Path(caminho_queries).exists():
        return {}

    with open(caminho_queries, encoding="utf-8") as arquivo:
        queries = [linha.strip() for linha in arquivo if linha.strip()]

    ids_em_ordem = []
    with open(caminho_csv_bruto, encoding="utf-8") as arquivo:
        for linha in csv.DictReader(arquivo):
            input_id = linha.get("input_id")
            if input_id and input_id not in ids_em_ordem:
                ids_em_ordem.append(input_id)

    return dict(zip(ids_em_ordem, queries))


def telefone_para_whatsapp(telefone_bruto):
    """Converte um telefone brasileiro (como vem do Google Maps) num link wa.me. Retorna None se não der pra usar."""
    digitos = re.sub(r"\D", "", telefone_bruto or "")

    if not digitos:
        return None

    # remove o "0" de discagem interurbana, se vier na frente (ex: 0xx41...)
    if digitos.startswith("0"):
        digitos = digitos[1:]

    # remove o DDI 55 se já vier incluso, pra normalizar sempre a partir do DDD
    if digitos.startswith("55") and len(digitos) > 11:
        digitos = digitos[2:]

    if len(digitos) not in (10, 11):
        return None  # não parece um telefone brasileiro válido (DDD + número)

    ddd = digitos[:2]
    numero = digitos[2:]

    # celular sem o "9" na frente, em DDD que exige o "9" -> adiciona
    if len(numero) == 8 and ddd in DDDS_COM_NOVE:
        numero = "9" + numero

    return f"https://wa.me/55{ddd}{numero}"


def linha_qualifica(linha):
    tem_site = bool((linha.get("website") or "").strip())
    if tem_site:
        return False

    nota_bruta = (linha.get("review_rating") or "").strip()
    if not nota_bruta:
        return False

    try:
        nota = float(nota_bruta.replace(",", "."))
    except ValueError:
        return False

    return nota >= NOTA_MINIMA


def numero_seguro(valor_bruto, conversor, padrao=0):
    """Converte um valor de texto pra número, sem levantar exceção em formatos inesperados
    (ex: '1.234' com ponto de milhar, ou lixo não numérico vindo de uma mudança no scraper)."""
    texto = (valor_bruto or "").strip()
    if not texto:
        return padrao
    try:
        return conversor(texto.replace(",", "."))
    except ValueError:
        try:
            # tenta remover separadores de milhar antes de desistir
            return conversor(re.sub(r"[^\d.]", "", texto))
        except ValueError:
            logger.warning("valor numérico inesperado, usando padrão: %r", valor_bruto)
            return padrao


def _verificar_candidata(indice, linha):
    """Roda numa thread do pool: só a parte de rede (checar site real), sem tocar no banco."""
    nome_empresa = linha.get("title") or ""
    site_real_encontrado = buscar_site_da_empresa(nome_empresa, linha.get("address") or "")
    return indice, linha, site_real_encontrado


def processar(caminho_csv_bruto, caminho_queries=CAMINHO_QUERIES_PADRAO, callback_progresso=None):
    caminho_csv_bruto = Path(caminho_csv_bruto)
    PASTA_SAIDAS.mkdir(exist_ok=True)

    hoje = date.today().isoformat()
    agora = datetime.now().isoformat(timespec="seconds")
    queries_por_input_id = mapear_queries_por_input_id(caminho_csv_bruto, caminho_queries)
    novos = []
    descartados_por_site_real = 0
    erros_de_linha = 0
    total_no_csv = 0

    # Fase 1: filtra candidatas (rápido, sem rede) e prepara link do WhatsApp de cada uma
    candidatas = []
    with open(caminho_csv_bruto, encoding="utf-8") as arquivo:
        for linha in csv.DictReader(arquivo):
            total_no_csv += 1
            if not linha_qualifica(linha):
                continue
            link_whatsapp = telefone_para_whatsapp(linha.get("phone"))
            if not link_whatsapp:
                continue
            candidatas.append((linha, link_whatsapp))

    total_candidatas = len(candidatas)
    processadas = 0

    # Fase 2: verifica se cada candidata já tem site real, em paralelo (é tudo espera de
    # rede, então rodar várias ao mesmo tempo reduz muito o tempo total desta etapa)
    resultados_verificacao = {}
    with ThreadPoolExecutor(max_workers=VERIFICACOES_PARALELAS) as executor:
        futuros = [
            executor.submit(_verificar_candidata, indice, linha)
            for indice, (linha, _) in enumerate(candidatas)
        ]
        for futuro in as_completed(futuros):
            indice, linha, site_real_encontrado = futuro.result()
            resultados_verificacao[indice] = site_real_encontrado
            processadas += 1
            if callback_progresso:
                callback_progresso(processadas, total_candidatas, linha.get("title") or "")

    # Fase 3: grava no banco sequencialmente (evita concorrência de escrita no SQLite)
    conexao = sqlite3.connect(CAMINHO_BANCO, timeout=10)
    conexao.execute("PRAGMA journal_mode=WAL")
    conexao.execute("PRAGMA busy_timeout=10000")
    preparar_banco(conexao)

    linhas_desde_commit = 0
    try:
        for indice, (linha, link_whatsapp) in enumerate(candidatas):
            try:
                if resultados_verificacao.get(indice):
                    descartados_por_site_real += 1
                    continue  # tem site de verdade, só não estava cadastrado no Maps - não é lead

                place_id = linha.get("place_id") or linha.get("input_id")
                nota = numero_seguro(linha.get("review_rating"), float, padrao=0.0)
                num_avaliacoes = numero_seguro(linha.get("review_count"), lambda t: int(float(t)), padrao=0)
                query_origem = queries_por_input_id.get(linha.get("input_id"), "")
                nicho, cidade = extrair_nicho_e_cidade(query_origem)

                ja_existia = conexao.execute(
                    "SELECT 1 FROM leads WHERE place_id = ?", (place_id,)
                ).fetchone()

                # Sempre atualiza os campos "vivos" do Maps (podem ter mudado desde a
                # última captura), mas nunca mexe em status/tags/observações/mensagem_gerada/
                # proximo_followup - esses são dados que o usuário preencheu manualmente.
                conexao.execute(
                    """
                    INSERT INTO leads (
                        place_id, nome, categoria, endereco, nota, num_avaliacoes,
                        whatsapp_link, telefone, query_origem, nicho, cidade, visto_em, atualizado_em
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(place_id) DO UPDATE SET
                        nome = excluded.nome,
                        categoria = excluded.categoria,
                        endereco = excluded.endereco,
                        nota = excluded.nota,
                        num_avaliacoes = excluded.num_avaliacoes,
                        whatsapp_link = excluded.whatsapp_link,
                        telefone = excluded.telefone,
                        atualizado_em = excluded.atualizado_em
                    """,
                    (
                        place_id,
                        linha.get("title"),
                        linha.get("category"),
                        linha.get("address"),
                        nota,
                        num_avaliacoes,
                        link_whatsapp,
                        telefone_limpo(linha.get("phone")),
                        query_origem,
                        nicho,
                        cidade,
                        hoje,
                        agora,
                    ),
                )

                if not ja_existia:  # só é "novo" se realmente não existia antes
                    novos.append(
                        {
                            "nome": linha.get("title"),
                            "categoria": linha.get("category"),
                            "endereco": linha.get("address"),
                            "nota": nota,
                            "num_avaliacoes": num_avaliacoes,
                            "whatsapp": link_whatsapp,
                        }
                    )

                linhas_desde_commit += 1
                if linhas_desde_commit >= LINHAS_POR_COMMIT:
                    conexao.commit()
                    linhas_desde_commit = 0

            except Exception:
                erros_de_linha += 1
                logger.exception("erro ao processar uma linha do CSV bruto, pulando essa linha")
                continue
    finally:
        conexao.commit()  # commit final, cobre o que não bateu o múltiplo de LINHAS_POR_COMMIT
        conexao.close()

    caminho_saida = PASTA_SAIDAS / f"leads_novos_{hoje}.csv"
    with open(caminho_saida, "w", newline="", encoding="utf-8-sig") as arquivo:
        campos = ["nome", "categoria", "endereco", "nota", "num_avaliacoes", "whatsapp"]
        escritor = csv.DictWriter(arquivo, fieldnames=campos)
        escritor.writeheader()
        escritor.writerows(novos)

    print(f"Leads novos encontrados nesta rodada: {len(novos)}")
    if descartados_por_site_real:
        print(f"Descartados por já terem site de verdade (achado numa busca): {descartados_por_site_real}")
    if erros_de_linha:
        print(f"Atenção: {erros_de_linha} linha(s) do CSV tiveram erro e foram puladas (veja logs/prospeccao.log).")
    print(f"Planilha gerada: {caminho_saida}")

    return {
        "total_no_csv": total_no_csv,
        "novos": len(novos),
        "descartados_por_site_real": descartados_por_site_real,
        "erros_de_linha": erros_de_linha,
    }


if __name__ == "__main__":
    if len(sys.argv) not in (2, 3):
        print("Uso: py processar.py <caminho_do_csv_bruto> [caminho_queries.txt]")
        sys.exit(1)

    if len(sys.argv) == 3:
        processar(sys.argv[1], sys.argv[2])
    else:
        processar(sys.argv[1])
