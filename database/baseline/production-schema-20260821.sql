--
-- PostgreSQL database dump
--

\restrict sdrL7evJKpSAJ4HrLGYNGZYsNv9K3VuRCvx8a8x7OblQfnbwLDiw5DW3QpZcIGf

-- Dumped from database version 18.4 (Debian 18.4-1.pgdg13+1)
-- Dumped by pg_dump version 18.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: atividades_legislativas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.atividades_legislativas (
    id integer NOT NULL,
    ano integer,
    mes integer,
    tipo character varying(100),
    quantidade integer DEFAULT 0,
    criado_em timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: atividades_legislativas_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.atividades_legislativas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: atividades_legislativas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.atividades_legislativas_id_seq OWNED BY public.atividades_legislativas.id;


--
-- Name: auditoria; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.auditoria (
    id integer NOT NULL,
    usuario_id integer,
    acao character varying(100),
    tabela character varying(100),
    registro_id integer,
    detalhes text,
    criado_em timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: auditoria_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.auditoria_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: auditoria_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.auditoria_id_seq OWNED BY public.auditoria.id;


--
-- Name: cidadaos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cidadaos (
    id integer NOT NULL,
    nome character varying(200) NOT NULL,
    telefone character varying(30),
    bairro character varying(150),
    endereco text,
    cep character varying(20),
    cidade character varying(100),
    observacoes text,
    criado_em timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    whatsapp character varying(30),
    numero character varying(20),
    titulo_eleitoral character varying(30),
    zona_eleitoral character varying(10),
    secao_eleitoral character varying(10),
    escola_votacao character varying(200),
    lideranca character varying(200),
    familia character varying(200),
    foto character varying(500),
    documentos text,
    audios text,
    atualizado_em timestamp without time zone DEFAULT now()
);


--
-- Name: cidadaos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.cidadaos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: cidadaos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.cidadaos_id_seq OWNED BY public.cidadaos.id;


--
-- Name: conversas_cidadaos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conversas_cidadaos (
    id integer NOT NULL,
    cidadao_id integer NOT NULL,
    telefone character varying(30),
    tipo character varying(20) NOT NULL,
    mensagem text,
    origem character varying(50),
    criado_em timestamp without time zone DEFAULT now()
);


--
-- Name: conversas_cidadaos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.conversas_cidadaos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: conversas_cidadaos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.conversas_cidadaos_id_seq OWNED BY public.conversas_cidadaos.id;


--
-- Name: conversas_whatsapp; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conversas_whatsapp (
    id integer NOT NULL,
    telefone character varying(30) NOT NULL,
    nome character varying(200),
    ultimo_contato timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    criado_em timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: conversas_whatsapp_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.conversas_whatsapp_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: conversas_whatsapp_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.conversas_whatsapp_id_seq OWNED BY public.conversas_whatsapp.id;


--
-- Name: demandas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.demandas (
    id integer NOT NULL,
    protocolo character varying(30) NOT NULL,
    nome character varying(200) NOT NULL,
    telefone character varying(30),
    bairro character varying(150),
    endereco text,
    servico character varying(200),
    secretaria character varying(150),
    descricao text,
    status character varying(50) DEFAULT 'RECEBIDA'::character varying,
    data_criacao timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: demandas_gabinete; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.demandas_gabinete (
    id integer NOT NULL,
    cidadao_id integer,
    protocolo character varying(50),
    assunto character varying(200),
    descricao text,
    secretaria character varying(150),
    bairro character varying(150),
    status character varying(50) DEFAULT 'RECEBIDA'::character varying,
    data timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    criado_em timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    hash_registro character varying(64)
);


--
-- Name: demandas_gabinete_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.demandas_gabinete_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: demandas_gabinete_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.demandas_gabinete_id_seq OWNED BY public.demandas_gabinete.id;


--
-- Name: demandas_historicas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.demandas_historicas (
    id integer NOT NULL,
    ano integer,
    mes integer,
    secretaria character varying(150),
    quantidade integer DEFAULT 0,
    criado_em timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: demandas_historicas_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.demandas_historicas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: demandas_historicas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.demandas_historicas_id_seq OWNED BY public.demandas_historicas.id;


--
-- Name: demandas_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.demandas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: demandas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.demandas_id_seq OWNED BY public.demandas.id;


--
-- Name: eleitores; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.eleitores (
    id integer NOT NULL,
    nome character varying(200) NOT NULL,
    cpf character varying(20),
    telefone character varying(30),
    bairro character varying(150),
    zona character varying(20),
    secao character varying(20),
    endereco text,
    observacao text,
    criado_em timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: eleitores_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.eleitores_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: eleitores_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.eleitores_id_seq OWNED BY public.eleitores.id;


--
-- Name: historico_cidadaos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.historico_cidadaos (
    id integer NOT NULL,
    cidadao_id integer NOT NULL,
    tipo character varying(50) NOT NULL,
    descricao text NOT NULL,
    usuario character varying(150),
    criado_em timestamp without time zone DEFAULT now()
);


--
-- Name: historico_cidadaos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.historico_cidadaos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: historico_cidadaos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.historico_cidadaos_id_seq OWNED BY public.historico_cidadaos.id;


--
-- Name: importacoes_eleitores; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.importacoes_eleitores (
    id integer NOT NULL,
    candidato_id integer NOT NULL,
    usuario_id integer,
    nome_arquivo character varying(255) NOT NULL,
    total_linhas integer DEFAULT 0 NOT NULL,
    inseridos integer DEFAULT 0 NOT NULL,
    atualizados integer DEFAULT 0 NOT NULL,
    ignorados integer DEFAULT 0 NOT NULL,
    erros integer DEFAULT 0 NOT NULL,
    status character varying(30) DEFAULT 'CONCLUIDA'::character varying NOT NULL,
    detalhes_erros jsonb,
    criado_em timestamp without time zone DEFAULT timezone('America/Sao_Paulo'::text, now()) NOT NULL
);


--
-- Name: importacoes_eleitores_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.importacoes_eleitores_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: importacoes_eleitores_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.importacoes_eleitores_id_seq OWNED BY public.importacoes_eleitores.id;


--
-- Name: importacoes_gabinete; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.importacoes_gabinete (
    id integer NOT NULL,
    arquivo character varying(255),
    hash_arquivo character varying(64),
    lote integer,
    criado_em timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: importacoes_gabinete_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.importacoes_gabinete_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: importacoes_gabinete_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.importacoes_gabinete_id_seq OWNED BY public.importacoes_gabinete.id;


--
-- Name: interacoes_mensais; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.interacoes_mensais (
    id integer NOT NULL,
    ano integer,
    mes integer,
    quantidade integer DEFAULT 0,
    criado_em timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: interacoes_mensais_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.interacoes_mensais_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: interacoes_mensais_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.interacoes_mensais_id_seq OWNED BY public.interacoes_mensais.id;


--
-- Name: liderancas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.liderancas (
    id integer NOT NULL,
    bairro character varying(120) NOT NULL,
    nome character varying(160) NOT NULL,
    telefone character varying(40),
    observacao text,
    ativo boolean DEFAULT true,
    criado_em timestamp without time zone DEFAULT now()
);


--
-- Name: liderancas_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.liderancas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: liderancas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.liderancas_id_seq OWNED BY public.liderancas.id;


--
-- Name: mensagens_whatsapp; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mensagens_whatsapp (
    id integer NOT NULL,
    conversa_id integer,
    telefone character varying(30),
    mensagem text,
    tipo character varying(50),
    origem character varying(50),
    criado_em timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: mensagens_whatsapp_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.mensagens_whatsapp_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: mensagens_whatsapp_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.mensagens_whatsapp_id_seq OWNED BY public.mensagens_whatsapp.id;


--
-- Name: solicitacoes_publicas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.solicitacoes_publicas (
    id integer NOT NULL,
    protocolo character varying(30) NOT NULL,
    ano integer NOT NULL,
    mes integer NOT NULL,
    solicitante character varying(150) NOT NULL,
    telefone character varying(30),
    bairro character varying(120),
    endereco text,
    servico character varying(120) NOT NULL,
    secretaria character varying(120) NOT NULL,
    descricao text NOT NULL,
    status character varying(50) DEFAULT 'RECEBIDA'::character varying,
    origem character varying(50) DEFAULT 'SITE_PUBLICO'::character varying,
    criado_em timestamp without time zone DEFAULT now(),
    cidadao_id integer
);


--
-- Name: solicitacoes_publicas_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.solicitacoes_publicas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: solicitacoes_publicas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.solicitacoes_publicas_id_seq OWNED BY public.solicitacoes_publicas.id;


--
-- Name: usuarios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.usuarios (
    id integer NOT NULL,
    nome character varying(120) NOT NULL,
    email character varying(150),
    cpf character varying(14) NOT NULL,
    senha_hash text NOT NULL,
    perfil character varying(30) DEFAULT 'ADMIN'::character varying NOT NULL,
    ativo boolean DEFAULT true,
    criado_em timestamp without time zone DEFAULT now()
);


--
-- Name: usuarios_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.usuarios_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: usuarios_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.usuarios_id_seq OWNED BY public.usuarios.id;


--
-- Name: atividades_legislativas id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atividades_legislativas ALTER COLUMN id SET DEFAULT nextval('public.atividades_legislativas_id_seq'::regclass);


--
-- Name: auditoria id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditoria ALTER COLUMN id SET DEFAULT nextval('public.auditoria_id_seq'::regclass);


--
-- Name: cidadaos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cidadaos ALTER COLUMN id SET DEFAULT nextval('public.cidadaos_id_seq'::regclass);


--
-- Name: conversas_cidadaos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversas_cidadaos ALTER COLUMN id SET DEFAULT nextval('public.conversas_cidadaos_id_seq'::regclass);


--
-- Name: conversas_whatsapp id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversas_whatsapp ALTER COLUMN id SET DEFAULT nextval('public.conversas_whatsapp_id_seq'::regclass);


--
-- Name: demandas id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.demandas ALTER COLUMN id SET DEFAULT nextval('public.demandas_id_seq'::regclass);


--
-- Name: demandas_gabinete id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.demandas_gabinete ALTER COLUMN id SET DEFAULT nextval('public.demandas_gabinete_id_seq'::regclass);


--
-- Name: demandas_historicas id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.demandas_historicas ALTER COLUMN id SET DEFAULT nextval('public.demandas_historicas_id_seq'::regclass);


--
-- Name: eleitores id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eleitores ALTER COLUMN id SET DEFAULT nextval('public.eleitores_id_seq'::regclass);


--
-- Name: historico_cidadaos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.historico_cidadaos ALTER COLUMN id SET DEFAULT nextval('public.historico_cidadaos_id_seq'::regclass);


--
-- Name: importacoes_eleitores id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.importacoes_eleitores ALTER COLUMN id SET DEFAULT nextval('public.importacoes_eleitores_id_seq'::regclass);


--
-- Name: importacoes_gabinete id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.importacoes_gabinete ALTER COLUMN id SET DEFAULT nextval('public.importacoes_gabinete_id_seq'::regclass);


--
-- Name: interacoes_mensais id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interacoes_mensais ALTER COLUMN id SET DEFAULT nextval('public.interacoes_mensais_id_seq'::regclass);


--
-- Name: liderancas id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liderancas ALTER COLUMN id SET DEFAULT nextval('public.liderancas_id_seq'::regclass);


--
-- Name: mensagens_whatsapp id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mensagens_whatsapp ALTER COLUMN id SET DEFAULT nextval('public.mensagens_whatsapp_id_seq'::regclass);


--
-- Name: solicitacoes_publicas id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solicitacoes_publicas ALTER COLUMN id SET DEFAULT nextval('public.solicitacoes_publicas_id_seq'::regclass);


--
-- Name: usuarios id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios ALTER COLUMN id SET DEFAULT nextval('public.usuarios_id_seq'::regclass);


--
-- Name: atividades_legislativas atividades_legislativas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atividades_legislativas
    ADD CONSTRAINT atividades_legislativas_pkey PRIMARY KEY (id);


--
-- Name: auditoria auditoria_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditoria
    ADD CONSTRAINT auditoria_pkey PRIMARY KEY (id);


--
-- Name: cidadaos cidadaos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cidadaos
    ADD CONSTRAINT cidadaos_pkey PRIMARY KEY (id);


--
-- Name: conversas_cidadaos conversas_cidadaos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversas_cidadaos
    ADD CONSTRAINT conversas_cidadaos_pkey PRIMARY KEY (id);


--
-- Name: conversas_whatsapp conversas_whatsapp_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversas_whatsapp
    ADD CONSTRAINT conversas_whatsapp_pkey PRIMARY KEY (id);


--
-- Name: demandas_gabinete demandas_gabinete_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.demandas_gabinete
    ADD CONSTRAINT demandas_gabinete_pkey PRIMARY KEY (id);


--
-- Name: demandas_historicas demandas_historicas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.demandas_historicas
    ADD CONSTRAINT demandas_historicas_pkey PRIMARY KEY (id);


--
-- Name: demandas demandas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.demandas
    ADD CONSTRAINT demandas_pkey PRIMARY KEY (id);


--
-- Name: demandas demandas_protocolo_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.demandas
    ADD CONSTRAINT demandas_protocolo_key UNIQUE (protocolo);


--
-- Name: eleitores eleitores_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eleitores
    ADD CONSTRAINT eleitores_pkey PRIMARY KEY (id);


--
-- Name: historico_cidadaos historico_cidadaos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.historico_cidadaos
    ADD CONSTRAINT historico_cidadaos_pkey PRIMARY KEY (id);


--
-- Name: importacoes_eleitores importacoes_eleitores_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.importacoes_eleitores
    ADD CONSTRAINT importacoes_eleitores_pkey PRIMARY KEY (id);


--
-- Name: importacoes_gabinete importacoes_gabinete_hash_arquivo_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.importacoes_gabinete
    ADD CONSTRAINT importacoes_gabinete_hash_arquivo_key UNIQUE (hash_arquivo);


--
-- Name: importacoes_gabinete importacoes_gabinete_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.importacoes_gabinete
    ADD CONSTRAINT importacoes_gabinete_pkey PRIMARY KEY (id);


--
-- Name: interacoes_mensais interacoes_mensais_ano_mes_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interacoes_mensais
    ADD CONSTRAINT interacoes_mensais_ano_mes_unique UNIQUE (ano, mes);


--
-- Name: interacoes_mensais interacoes_mensais_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interacoes_mensais
    ADD CONSTRAINT interacoes_mensais_pkey PRIMARY KEY (id);


--
-- Name: liderancas liderancas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liderancas
    ADD CONSTRAINT liderancas_pkey PRIMARY KEY (id);


--
-- Name: mensagens_whatsapp mensagens_whatsapp_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mensagens_whatsapp
    ADD CONSTRAINT mensagens_whatsapp_pkey PRIMARY KEY (id);


--
-- Name: solicitacoes_publicas solicitacoes_publicas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solicitacoes_publicas
    ADD CONSTRAINT solicitacoes_publicas_pkey PRIMARY KEY (id);


--
-- Name: solicitacoes_publicas solicitacoes_publicas_protocolo_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solicitacoes_publicas
    ADD CONSTRAINT solicitacoes_publicas_protocolo_key UNIQUE (protocolo);


--
-- Name: interacoes_mensais uk_interacoes_ano_mes; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interacoes_mensais
    ADD CONSTRAINT uk_interacoes_ano_mes UNIQUE (ano, mes);


--
-- Name: usuarios usuarios_cpf_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_cpf_key UNIQUE (cpf);


--
-- Name: usuarios usuarios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_pkey PRIMARY KEY (id);


--
-- Name: idx_demandas_gabinete_hash_registro; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_demandas_gabinete_hash_registro ON public.demandas_gabinete USING btree (hash_registro) WHERE ((hash_registro IS NOT NULL) AND (TRIM(BOTH FROM hash_registro) <> ''::text));


--
-- Name: idx_demandas_protocolo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_demandas_protocolo ON public.demandas USING btree (protocolo);


--
-- Name: idx_eleitores_nome; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_eleitores_nome ON public.eleitores USING btree (nome);


--
-- Name: idx_importacoes_eleitores_candidato; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_importacoes_eleitores_candidato ON public.importacoes_eleitores USING btree (candidato_id);


--
-- Name: idx_importacoes_eleitores_data; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_importacoes_eleitores_data ON public.importacoes_eleitores USING btree (criado_em DESC);


--
-- Name: idx_whatsapp_telefone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_whatsapp_telefone ON public.conversas_whatsapp USING btree (telefone);


--
-- Name: demandas_gabinete demandas_gabinete_cidadao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.demandas_gabinete
    ADD CONSTRAINT demandas_gabinete_cidadao_id_fkey FOREIGN KEY (cidadao_id) REFERENCES public.cidadaos(id);


--
-- Name: conversas_cidadaos fk_conversa_cidadao; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversas_cidadaos
    ADD CONSTRAINT fk_conversa_cidadao FOREIGN KEY (cidadao_id) REFERENCES public.cidadaos(id) ON DELETE CASCADE;


--
-- Name: historico_cidadaos fk_historico_cidadao; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.historico_cidadaos
    ADD CONSTRAINT fk_historico_cidadao FOREIGN KEY (cidadao_id) REFERENCES public.cidadaos(id) ON DELETE CASCADE;


--
-- Name: solicitacoes_publicas fk_solicitacao_cidadao; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solicitacoes_publicas
    ADD CONSTRAINT fk_solicitacao_cidadao FOREIGN KEY (cidadao_id) REFERENCES public.cidadaos(id);


--
-- Name: mensagens_whatsapp mensagens_whatsapp_conversa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mensagens_whatsapp
    ADD CONSTRAINT mensagens_whatsapp_conversa_id_fkey FOREIGN KEY (conversa_id) REFERENCES public.conversas_whatsapp(id);


--
-- PostgreSQL database dump complete
--

\unrestrict sdrL7evJKpSAJ4HrLGYNGZYsNv9K3VuRCvx8a8x7OblQfnbwLDiw5DW3QpZcIGf
