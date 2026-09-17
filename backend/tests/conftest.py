"""Configuração compartilhada dos testes.

O app tem login por senha (before_request em app.py). Os testes exercitam as
rotas diretamente, sem sessão de login — então o ambiente de teste roda com
PROSPECCAO_DEBUG=true, que faz o before_request liberar as rotas (mesma flag
de dev). O valor é válido só dentro de cada teste (monkeypatch).
"""

import pytest


@pytest.fixture(autouse=True)
def sem_login_nos_testes(monkeypatch):
    monkeypatch.setenv("PROSPECCAO_DEBUG", "true")
    yield
