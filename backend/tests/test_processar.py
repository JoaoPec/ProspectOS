"""
Testes das funções puras de processar.py (sem depender de rede, scraper ou banco real).
Rodar com: py -m pytest
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from processar import (
    dominio_e_proprio,
    extrair_nicho_e_cidade,
    linha_qualifica,
    mapear_queries_por_input_id,
    telefone_para_whatsapp,
)


class TestTelefoneParaWhatsapp:
    def test_celular_com_nove_digitos_e_ddd_curitiba(self):
        assert telefone_para_whatsapp("(41) 98480-1109") == "https://wa.me/5541984801109"

    def test_ja_vem_com_ddi_55(self):
        assert telefone_para_whatsapp("5541984801109") == "https://wa.me/5541984801109"

    def test_celular_sem_o_nove_em_ddd_que_exige(self):
        # DDD 11 (São Paulo) está na lista DDDS_COM_NOVE; número de 8 dígitos deve ganhar o "9"
        assert telefone_para_whatsapp("(11) 8480-1109") == "https://wa.me/5511984801109"

    def test_com_zero_de_discagem_interurbana(self):
        assert telefone_para_whatsapp("041984801109") == "https://wa.me/5541984801109"

    def test_ddd_que_nao_exige_o_nove_fica_como_esta(self):
        # DDD 47 (Santa Catarina) não está na lista DDDS_COM_NOVE
        resultado = telefone_para_whatsapp("(47) 3222-1109")
        assert resultado == "https://wa.me/554732221109"

    def test_vazio_retorna_none(self):
        assert telefone_para_whatsapp("") is None
        assert telefone_para_whatsapp(None) is None

    def test_so_letras_retorna_none(self):
        assert telefone_para_whatsapp("não tem telefone") is None

    def test_numero_muito_curto_retorna_none(self):
        assert telefone_para_whatsapp("12345") is None

    def test_numero_muito_longo_retorna_none(self):
        assert telefone_para_whatsapp("123456789012345") is None


class TestLinhaQualifica:
    def test_nota_com_virgula_decimal(self):
        linha = {"website": "", "review_rating": "4,5"}
        assert linha_qualifica(linha) is True

    def test_nota_com_ponto_decimal(self):
        linha = {"website": "", "review_rating": "4.5"}
        assert linha_qualifica(linha) is True

    def test_nota_abaixo_do_minimo(self):
        linha = {"website": "", "review_rating": "3.9"}
        assert linha_qualifica(linha) is False

    def test_nota_exatamente_no_minimo(self):
        linha = {"website": "", "review_rating": "4.0"}
        assert linha_qualifica(linha) is True

    def test_com_site_preenchido_desqualifica(self):
        linha = {"website": "https://empresa.com.br", "review_rating": "5.0"}
        assert linha_qualifica(linha) is False

    def test_nota_ausente_desqualifica(self):
        linha = {"website": "", "review_rating": ""}
        assert linha_qualifica(linha) is False

    def test_nota_invalida_desqualifica(self):
        linha = {"website": "", "review_rating": "não é nota"}
        assert linha_qualifica(linha) is False


class TestDominioEProprio:
    def test_site_proprio_e_aceito(self):
        assert dominio_e_proprio("https://www.minhaempresa.com.br") is True

    def test_site_proprio_sem_www(self):
        assert dominio_e_proprio("https://minhaempresa.com.br/pagina") is True

    def test_facebook_e_rejeitado(self):
        assert dominio_e_proprio("https://facebook.com/empresa") is False

    def test_subdominio_de_rede_social_e_rejeitado(self):
        # este é o bug corrigido: antes só pegava "facebook.com" exato,
        # subdomínios como "blog.facebook.com" ou "m.facebook.com" passavam batendo
        assert dominio_e_proprio("https://blog.facebook.com/empresa") is False
        assert dominio_e_proprio("https://m.facebook.com/empresa") is False

    def test_subdominio_de_agregador_imobiliario_e_rejeitado(self):
        assert dominio_e_proprio("https://www.vivareal.com.br/imovel/123") is False
        assert dominio_e_proprio("https://busca.vivareal.com.br/imovel/123") is False

    def test_url_invalida_e_rejeitada(self):
        assert dominio_e_proprio("") is False
        assert dominio_e_proprio(None) is False


class TestMapearQueriesPorInputId:
    def test_associa_pela_ordem_de_aparicao(self, tmp_path):
        caminho_csv = tmp_path / "bruto.csv"
        caminho_csv.write_text(
            "input_id,title\n"
            "id-1,Empresa A\n"
            "id-1,Empresa B\n"
            "id-2,Empresa C\n",
            encoding="utf-8",
        )
        caminho_queries = tmp_path / "queries.txt"
        caminho_queries.write_text("nicho um\nnicho dois\n", encoding="utf-8")

        resultado = mapear_queries_por_input_id(caminho_csv, caminho_queries)

        assert resultado == {"id-1": "nicho um", "id-2": "nicho dois"}

    def test_arquivo_de_queries_inexistente_retorna_vazio(self, tmp_path):
        caminho_csv = tmp_path / "bruto.csv"
        caminho_csv.write_text("input_id,title\nid-1,Empresa A\n", encoding="utf-8")

        resultado = mapear_queries_por_input_id(caminho_csv, tmp_path / "nao_existe.txt")

        assert resultado == {}


class TestExtrairNichoECidade:
    def test_separa_nicho_e_cidade_com_uf(self):
        assert extrair_nicho_e_cidade("corretor de imóveis em São Francisco MG") == (
            "corretor de imóveis",
            "São Francisco MG",
        )

    def test_separa_nicho_e_cidade_sem_uf(self):
        assert extrair_nicho_e_cidade("clínica de estética em Londrina") == (
            "clínica de estética",
            "Londrina",
        )

    def test_cidade_com_nome_composto(self):
        assert extrair_nicho_e_cidade("arquiteto em Ribeirão Preto") == (
            "arquiteto",
            "Ribeirão Preto",
        )

    def test_usa_ultima_ocorrencia_de_em_como_separador(self):
        # se o nome do nicho tivesse "em" no meio, a ÚLTIMA ocorrência de " em "
        # ainda deve separar corretamente a cidade no final
        assert extrair_nicho_e_cidade("designer de embalagens em Curitiba") == (
            "designer de embalagens",
            "Curitiba",
        )

    def test_sem_padrao_em_retorna_tudo_como_nicho(self):
        assert extrair_nicho_e_cidade("nicho sem cidade") == ("nicho sem cidade", "")

    def test_vazio_retorna_vazio(self):
        assert extrair_nicho_e_cidade("") == ("", "")
        assert extrair_nicho_e_cidade(None) == ("", "")
