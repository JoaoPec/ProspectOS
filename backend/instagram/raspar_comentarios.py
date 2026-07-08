"""
Extrai os comentários de um post do Instagram e salva em JSON.

Uso:
    py raspar_comentarios.py <url_do_post>

Requer sessão salva previamente com:
    py login.py <seu_usuario>
"""

import json
import sys
from datetime import datetime
from pathlib import Path

from instagrapi import Client
from instagrapi.exceptions import ClientError, LoginRequired

PASTA_SESSAO = Path(__file__).parent / "sessao"
PASTA_COMENTARIOS = Path(__file__).parent / "comentarios"


def carregar_sessao() -> Client:
    arquivos_sessao = list(PASTA_SESSAO.glob("session-*.json"))
    if not arquivos_sessao:
        raise RuntimeError(
            "Nenhuma sessão salva encontrada em instagram/sessao/. "
            "Rode primeiro: py login.py <seu_usuario>"
        )
    cliente = Client()
    cliente.load_settings(arquivos_sessao[0])
    return cliente


def raspar_comentarios(url: str) -> Path:
    cliente = carregar_sessao()

    media_pk = cliente.media_pk_from_url(url)
    comentarios_brutos = cliente.media_comments(media_pk, amount=0)

    comentarios = [
        {"username": c.user.username, "texto": c.text}
        for c in comentarios_brutos
    ]

    resultado = {
        "post_url": url,
        "capturado_em": datetime.now().isoformat(timespec="seconds"),
        "total_comentarios": len(comentarios),
        "comentarios": comentarios,
    }

    PASTA_COMENTARIOS.mkdir(parents=True, exist_ok=True)
    nome_arquivo = f"post_{media_pk}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    caminho_saida = PASTA_COMENTARIOS / nome_arquivo
    caminho_saida.write_text(
        json.dumps(resultado, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    return caminho_saida


def main() -> None:
    if len(sys.argv) != 2:
        print("Uso: py raspar_comentarios.py <url_do_post>")
        sys.exit(1)

    url = sys.argv[1]

    try:
        caminho_saida = raspar_comentarios(url)
    except RuntimeError as erro:
        print(f"Erro: {erro}")
        sys.exit(1)
    except LoginRequired:
        print(
            "Erro: a sessão expirou ou foi invalidada. Rode de novo: "
            "py login.py <seu_usuario>"
        )
        sys.exit(1)
    except ClientError as erro:
        print(
            f"Erro ao acessar o post (pode ser privado, ter sido removido, "
            f"ou rate limit do Instagram): {erro}"
        )
        sys.exit(1)

    print(f"Comentários salvos em: {caminho_saida}")


if __name__ == "__main__":
    main()
