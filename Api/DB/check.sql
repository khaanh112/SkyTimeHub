--
-- PostgreSQL database dump
--

\restrict nmEegTtWFcHjNdDFh6FLsmkMOcfWUPJKNtePHf7ATNLga5LfNf6KFzY181FIyJh

-- Dumped from database version 16.11 (Debian 16.11-1.pgdg13+1)
-- Dumped by pg_dump version 16.10

-- Started on 2026-02-26 03:51:41 UTC

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 6 (class 2615 OID 16999)
-- Name: public; Type: SCHEMA; Schema: -; Owner: sky
--

-- *not* creating schema, since initdb creates it


ALTER SCHEMA public OWNER TO sky;

--
-- TOC entry 4026 (class 0 OID 0)
-- Dependencies: 6
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: sky
--

COMMENT ON SCHEMA public IS '';


--
-- TOC entry 2 (class 3079 OID 45589)
-- Name: btree_gist; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA public;


--
-- TOC entry 4028 (class 0 OID 0)
-- Dependencies: 2
-- Name: EXTENSION btree_gist; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION btree_gist IS 'support for indexing common datatypes in GiST';


--
-- TOC entry 1078 (class 1247 OID 46848)
-- Name: comp_tx_dir; Type: TYPE; Schema: public; Owner: sky
--

CREATE TYPE public.comp_tx_dir AS ENUM (
    'CREDIT',
    'DEBIT'
);


ALTER TYPE public.comp_tx_dir OWNER TO sky;

--
-- TOC entry 1081 (class 1247 OID 46854)
-- Name: comp_tx_source; Type: TYPE; Schema: public; Owner: sky
--

CREATE TYPE public.comp_tx_source AS ENUM (
    'MAKEUP_APPROVAL',
    'LEAVE_APPROVAL',
    'ADJUSTMENT'
);


ALTER TYPE public.comp_tx_source OWNER TO sky;

--
-- TOC entry 1072 (class 1247 OID 46812)
-- Name: comp_work_status; Type: TYPE; Schema: public; Owner: sky
--

CREATE TYPE public.comp_work_status AS ENUM (
    'pending',
    'approved',
    'rejected',
    'cancelled'
);


ALTER TYPE public.comp_work_status OWNER TO sky;

--
-- TOC entry 1088 (class 1247 OID 45542)
-- Name: leave_session; Type: TYPE; Schema: public; Owner: sky
--

CREATE TYPE public.leave_session AS ENUM (
    'AM',
    'PM'
);


ALTER TYPE public.leave_session OWNER TO sky;

--
-- TOC entry 1109 (class 1247 OID 17022)
-- Name: leave_status; Type: TYPE; Schema: public; Owner: sky
--

CREATE TYPE public.leave_status AS ENUM (
    'pending',
    'approved',
    'rejected',
    'cancelled',
    'done'
);


ALTER TYPE public.leave_status OWNER TO sky;

--
-- TOC entry 1115 (class 1247 OID 17062)
-- Name: ot_benefit_type; Type: TYPE; Schema: public; Owner: sky
--

CREATE TYPE public.ot_benefit_type AS ENUM (
    'compensatory_leave',
    'overtime_pay'
);


ALTER TYPE public.ot_benefit_type OWNER TO sky;

--
-- TOC entry 1118 (class 1247 OID 17068)
-- Name: ot_condition; Type: TYPE; Schema: public; Owner: sky
--

CREATE TYPE public.ot_condition AS ENUM (
    'regular_day',
    'weekly_rest_day',
    'public_holiday',
    'night_regular_day_no_daytime',
    'night_regular_day_with_daytime',
    'night_weekly_rest_day',
    'night_public_holiday'
);


ALTER TYPE public.ot_condition OWNER TO sky;

--
-- TOC entry 1112 (class 1247 OID 17034)
-- Name: ot_status; Type: TYPE; Schema: public; Owner: sky
--

CREATE TYPE public.ot_status AS ENUM (
    'pending',
    'approved',
    'rejected',
    'cancelled',
    'done'
);


ALTER TYPE public.ot_status OWNER TO sky;

--
-- TOC entry 1063 (class 1247 OID 32722)
-- Name: recipient_type; Type: TYPE; Schema: public; Owner: sky
--

CREATE TYPE public.recipient_type AS ENUM (
    'HR',
    'CC',
    'SYSTEM'
);


ALTER TYPE public.recipient_type OWNER TO sky;

--
-- TOC entry 1082 (class 1247 OID 36214)
-- Name: user_gender_enum; Type: TYPE; Schema: public; Owner: sky
--

CREATE TYPE public.user_gender_enum AS ENUM (
    'male',
    'female'
);


ALTER TYPE public.user_gender_enum OWNER TO sky;

--
-- TOC entry 1103 (class 1247 OID 17002)
-- Name: user_role; Type: TYPE; Schema: public; Owner: sky
--

CREATE TYPE public.user_role AS ENUM (
    'admin',
    'hr',
    'employee',
    'department_leader',
    'bod'
);


ALTER TYPE public.user_role OWNER TO sky;

--
-- TOC entry 1106 (class 1247 OID 17014)
-- Name: user_status; Type: TYPE; Schema: public; Owner: sky
--

CREATE TYPE public.user_status AS ENUM (
    'pending',
    'active',
    'inactive',
    'suspended'
);


ALTER TYPE public.user_status OWNER TO sky;

--
-- TOC entry 1085 (class 1247 OID 36228)
-- Name: users_contract_type_enum; Type: TYPE; Schema: public; Owner: sky
--

CREATE TYPE public.users_contract_type_enum AS ENUM (
    'intern',
    'probation',
    'part_time',
    'full_time'
);


ALTER TYPE public.users_contract_type_enum OWNER TO sky;

--
-- TOC entry 349 (class 1255 OID 17406)
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: sky
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_updated_at_column() OWNER TO sky;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 235 (class 1259 OID 46277)
-- Name: calendar_overrides; Type: TABLE; Schema: public; Owner: sky
--

CREATE TABLE public.calendar_overrides (
    id bigint NOT NULL,
    date date NOT NULL,
    type character varying(30) NOT NULL,
    name character varying(200),
    year integer NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    CONSTRAINT ck_cal_type CHECK (((type)::text = ANY ((ARRAY['HOLIDAY'::character varying, 'WORKING_OVERRIDE'::character varying])::text[])))
);


ALTER TABLE public.calendar_overrides OWNER TO sky;

--
-- TOC entry 234 (class 1259 OID 46276)
-- Name: calendar_overrides_id_seq; Type: SEQUENCE; Schema: public; Owner: sky
--

CREATE SEQUENCE public.calendar_overrides_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.calendar_overrides_id_seq OWNER TO sky;

--
-- TOC entry 4029 (class 0 OID 0)
-- Dependencies: 234
-- Name: calendar_overrides_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: sky
--

ALTER SEQUENCE public.calendar_overrides_id_seq OWNED BY public.calendar_overrides.id;


--
-- TOC entry 249 (class 1259 OID 46862)
-- Name: comp_balance_transactions; Type: TABLE; Schema: public; Owner: sky
--

CREATE TABLE public.comp_balance_transactions (
    id bigint NOT NULL,
    employee_id integer NOT NULL,
    direction public.comp_tx_dir NOT NULL,
    amount_minutes integer NOT NULL,
    source_type public.comp_tx_source NOT NULL,
    source_id bigint,
    note text,
    created_at timestamp without time zone DEFAULT now(),
    CONSTRAINT ck_comp_tx_positive CHECK ((amount_minutes > 0)),
    CONSTRAINT ck_comp_tx_step CHECK (((amount_minutes % 30) = 0))
);


ALTER TABLE public.comp_balance_transactions OWNER TO sky;

--
-- TOC entry 248 (class 1259 OID 46861)
-- Name: comp_balance_transactions_id_seq; Type: SEQUENCE; Schema: public; Owner: sky
--

CREATE SEQUENCE public.comp_balance_transactions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.comp_balance_transactions_id_seq OWNER TO sky;

--
-- TOC entry 4030 (class 0 OID 0)
-- Dependencies: 248
-- Name: comp_balance_transactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: sky
--

ALTER SEQUENCE public.comp_balance_transactions_id_seq OWNED BY public.comp_balance_transactions.id;


--
-- TOC entry 247 (class 1259 OID 46822)
-- Name: comp_work_requests; Type: TABLE; Schema: public; Owner: sky
--

CREATE TABLE public.comp_work_requests (
    id bigint NOT NULL,
    employee_id integer NOT NULL,
    work_date date NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    duration_minutes integer NOT NULL,
    status public.comp_work_status DEFAULT 'pending'::public.comp_work_status NOT NULL,
    approver_id integer,
    approved_at timestamp without time zone,
    rejected_reason text,
    created_at timestamp without time zone DEFAULT now(),
    CONSTRAINT ck_comp_positive CHECK ((duration_minutes > 0)),
    CONSTRAINT ck_comp_step CHECK (((duration_minutes % 30) = 0)),
    CONSTRAINT ck_comp_time CHECK ((end_time > start_time))
);


ALTER TABLE public.comp_work_requests OWNER TO sky;

--
-- TOC entry 246 (class 1259 OID 46821)
-- Name: comp_work_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: sky
--

CREATE SEQUENCE public.comp_work_requests_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.comp_work_requests_id_seq OWNER TO sky;

--
-- TOC entry 4031 (class 0 OID 0)
-- Dependencies: 246
-- Name: comp_work_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: sky
--

ALTER SEQUENCE public.comp_work_requests_id_seq OWNED BY public.comp_work_requests.id;


--
-- TOC entry 217 (class 1259 OID 17084)
-- Name: departments; Type: TABLE; Schema: public; Owner: sky
--

CREATE TABLE public.departments (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    leader_id integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.departments OWNER TO sky;

--
-- TOC entry 216 (class 1259 OID 17083)
-- Name: departments_id_seq; Type: SEQUENCE; Schema: public; Owner: sky
--

CREATE SEQUENCE public.departments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.departments_id_seq OWNER TO sky;

--
-- TOC entry 4032 (class 0 OID 0)
-- Dependencies: 216
-- Name: departments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: sky
--

ALTER SEQUENCE public.departments_id_seq OWNED BY public.departments.id;


--
-- TOC entry 225 (class 1259 OID 32695)
-- Name: email_queue; Type: TABLE; Schema: public; Owner: sky
--

CREATE TABLE public.email_queue (
    id integer NOT NULL,
    recipient_user_id integer NOT NULL,
    type character varying NOT NULL,
    reference_kind character varying DEFAULT 'NONE'::character varying NOT NULL,
    reference_id integer,
    idempotency_key character varying NOT NULL,
    context jsonb NOT NULL,
    status character varying DEFAULT 'PENDING'::character varying NOT NULL,
    attempt_count integer DEFAULT 0,
    max_attempts integer DEFAULT 5,
    next_retry_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    processing_started_at timestamp with time zone,
    worker_id character varying,
    sent_at timestamp with time zone,
    failed_at timestamp with time zone,
    cancelled_at timestamp with time zone,
    skipped_at timestamp with time zone,
    error_message text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.email_queue OWNER TO sky;

--
-- TOC entry 224 (class 1259 OID 32694)
-- Name: email_queue_id_seq; Type: SEQUENCE; Schema: public; Owner: sky
--

CREATE SEQUENCE public.email_queue_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.email_queue_id_seq OWNER TO sky;

--
-- TOC entry 4033 (class 0 OID 0)
-- Dependencies: 224
-- Name: email_queue_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: sky
--

ALTER SEQUENCE public.email_queue_id_seq OWNED BY public.email_queue.id;


--
-- TOC entry 243 (class 1259 OID 46347)
-- Name: leave_balance_transactions; Type: TABLE; Schema: public; Owner: sky
--

CREATE TABLE public.leave_balance_transactions (
    id bigint NOT NULL,
    employee_id integer NOT NULL,
    leave_type_id bigint NOT NULL,
    period_year integer NOT NULL,
    period_month integer,
    direction character varying(10) NOT NULL,
    amount_days numeric(7,2) NOT NULL,
    source_type character varying(50) NOT NULL,
    source_id bigint,
    note text,
    created_at timestamp without time zone DEFAULT now(),
    CONSTRAINT ck_tx_dir CHECK (((direction)::text = ANY ((ARRAY['CREDIT'::character varying, 'DEBIT'::character varying])::text[]))),
    CONSTRAINT ck_tx_nonneg CHECK ((amount_days >= (0)::numeric)),
    CONSTRAINT ck_tx_step CHECK (((amount_days * (2)::numeric) = floor((amount_days * (2)::numeric))))
);


ALTER TABLE public.leave_balance_transactions OWNER TO sky;

--
-- TOC entry 242 (class 1259 OID 46346)
-- Name: leave_balance_transactions_id_seq; Type: SEQUENCE; Schema: public; Owner: sky
--

CREATE SEQUENCE public.leave_balance_transactions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.leave_balance_transactions_id_seq OWNER TO sky;

--
-- TOC entry 4034 (class 0 OID 0)
-- Dependencies: 242
-- Name: leave_balance_transactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: sky
--

ALTER SEQUENCE public.leave_balance_transactions_id_seq OWNED BY public.leave_balance_transactions.id;


--
-- TOC entry 231 (class 1259 OID 46242)
-- Name: leave_categories; Type: TABLE; Schema: public; Owner: sky
--

CREATE TABLE public.leave_categories (
    id bigint NOT NULL,
    code character varying(50) NOT NULL,
    name character varying(100) NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.leave_categories OWNER TO sky;

--
-- TOC entry 230 (class 1259 OID 46241)
-- Name: leave_categories_id_seq; Type: SEQUENCE; Schema: public; Owner: sky
--

CREATE SEQUENCE public.leave_categories_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.leave_categories_id_seq OWNER TO sky;

--
-- TOC entry 4035 (class 0 OID 0)
-- Dependencies: 230
-- Name: leave_categories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: sky
--

ALTER SEQUENCE public.leave_categories_id_seq OWNED BY public.leave_categories.id;


--
-- TOC entry 245 (class 1259 OID 46383)
-- Name: leave_request_attachments; Type: TABLE; Schema: public; Owner: sky
--

CREATE TABLE public.leave_request_attachments (
    id bigint NOT NULL,
    leave_request_id integer NOT NULL,
    original_filename character varying(255),
    content_type character varying(100) DEFAULT 'application/pdf'::character varying,
    size_bytes bigint,
    storage_provider character varying(30) NOT NULL,
    bucket character varying(255),
    object_key text NOT NULL,
    uploaded_by integer,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.leave_request_attachments OWNER TO sky;

--
-- TOC entry 244 (class 1259 OID 46382)
-- Name: leave_request_attachments_id_seq; Type: SEQUENCE; Schema: public; Owner: sky
--

CREATE SEQUENCE public.leave_request_attachments_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.leave_request_attachments_id_seq OWNER TO sky;

--
-- TOC entry 4036 (class 0 OID 0)
-- Dependencies: 244
-- Name: leave_request_attachments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: sky
--

ALTER SEQUENCE public.leave_request_attachments_id_seq OWNED BY public.leave_request_attachments.id;


--
-- TOC entry 241 (class 1259 OID 46325)
-- Name: leave_request_items; Type: TABLE; Schema: public; Owner: sky
--

CREATE TABLE public.leave_request_items (
    id bigint NOT NULL,
    leave_request_id integer NOT NULL,
    leave_type_id bigint NOT NULL,
    amount_days numeric(5,2) NOT NULL,
    note text,
    created_at timestamp without time zone DEFAULT now(),
    CONSTRAINT ck_item_nonneg CHECK ((amount_days >= (0)::numeric)),
    CONSTRAINT ck_item_step CHECK (((amount_days * (2)::numeric) = floor((amount_days * (2)::numeric))))
);


ALTER TABLE public.leave_request_items OWNER TO sky;

--
-- TOC entry 240 (class 1259 OID 46324)
-- Name: leave_request_items_id_seq; Type: SEQUENCE; Schema: public; Owner: sky
--

CREATE SEQUENCE public.leave_request_items_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.leave_request_items_id_seq OWNER TO sky;

--
-- TOC entry 4037 (class 0 OID 0)
-- Dependencies: 240
-- Name: leave_request_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: sky
--

ALTER SEQUENCE public.leave_request_items_id_seq OWNED BY public.leave_request_items.id;


--
-- TOC entry 229 (class 1259 OID 32752)
-- Name: leave_request_notification_recipients; Type: TABLE; Schema: public; Owner: sky
--

CREATE TABLE public.leave_request_notification_recipients (
    id integer NOT NULL,
    request_id integer NOT NULL,
    user_id integer NOT NULL,
    type public.recipient_type DEFAULT 'CC'::public.recipient_type,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.leave_request_notification_recipients OWNER TO sky;

--
-- TOC entry 228 (class 1259 OID 32751)
-- Name: leave_request_notification_recipients_id_seq; Type: SEQUENCE; Schema: public; Owner: sky
--

CREATE SEQUENCE public.leave_request_notification_recipients_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.leave_request_notification_recipients_id_seq OWNER TO sky;

--
-- TOC entry 4038 (class 0 OID 0)
-- Dependencies: 228
-- Name: leave_request_notification_recipients_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: sky
--

ALTER SEQUENCE public.leave_request_notification_recipients_id_seq OWNED BY public.leave_request_notification_recipients.id;


--
-- TOC entry 221 (class 1259 OID 17145)
-- Name: leave_requests; Type: TABLE; Schema: public; Owner: sky
--

CREATE TABLE public.leave_requests (
    id integer NOT NULL,
    user_id integer NOT NULL,
    reason text,
    start_date date NOT NULL,
    end_date date NOT NULL,
    start_session public.leave_session NOT NULL,
    end_session public.leave_session NOT NULL,
    duration numeric(5,2),
    status public.leave_status DEFAULT 'pending'::public.leave_status NOT NULL,
    approver_id integer,
    approved_at timestamp with time zone,
    rejected_reason text,
    cancelled_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    version integer DEFAULT 1,
    rejected_at timestamp with time zone,
    work_solution text,
    duration_days numeric(5,2),
    start_slot integer GENERATED ALWAYS AS ((((start_date - '2000-01-01'::date) * 2) +
CASE
    WHEN (start_session = 'PM'::public.leave_session) THEN 1
    ELSE 0
END)) STORED,
    end_slot integer GENERATED ALWAYS AS ((((end_date - '2000-01-01'::date) * 2) +
CASE
    WHEN (end_session = 'PM'::public.leave_session) THEN 1
    ELSE 0
END)) STORED,
    requested_leave_type_id bigint,
    use_comp_balance boolean DEFAULT false NOT NULL,
    comp_used_minutes integer DEFAULT 0 NOT NULL,
    CONSTRAINT ck_leave_comp_used_nonneg CHECK ((comp_used_minutes >= 0)),
    CONSTRAINT ck_leave_comp_used_step CHECK (((comp_used_minutes % 30) = 0)),
    CONSTRAINT ck_leave_duration_step CHECK (((duration_days IS NULL) OR ((duration_days * (2)::numeric) = floor((duration_days * (2)::numeric))))),
    CONSTRAINT ck_leave_request_date_order CHECK ((end_date >= start_date)),
    CONSTRAINT ck_leave_request_session_order CHECK (((end_date > start_date) OR ((start_session = 'AM'::public.leave_session) AND (end_session = ANY (ARRAY['AM'::public.leave_session, 'PM'::public.leave_session]))) OR ((start_session = 'PM'::public.leave_session) AND (end_session = 'PM'::public.leave_session)))),
    CONSTRAINT ck_leave_slot_order CHECK ((end_slot >= start_slot))
);


ALTER TABLE public.leave_requests OWNER TO sky;

--
-- TOC entry 220 (class 1259 OID 17144)
-- Name: leave_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: sky
--

CREATE SEQUENCE public.leave_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.leave_requests_id_seq OWNER TO sky;

--
-- TOC entry 4039 (class 0 OID 0)
-- Dependencies: 220
-- Name: leave_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: sky
--

ALTER SEQUENCE public.leave_requests_id_seq OWNED BY public.leave_requests.id;


--
-- TOC entry 239 (class 1259 OID 46304)
-- Name: leave_type_conversions; Type: TABLE; Schema: public; Owner: sky
--

CREATE TABLE public.leave_type_conversions (
    id bigint NOT NULL,
    from_leave_type_id bigint NOT NULL,
    to_leave_type_id bigint NOT NULL,
    priority integer NOT NULL,
    reason character varying(40) NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    CONSTRAINT ck_conv_priority CHECK ((priority > 0)),
    CONSTRAINT ck_conv_reason CHECK (((reason)::text = ANY ((ARRAY['EXCEED_MAX_PER_REQUEST'::character varying, 'EXCEED_BALANCE'::character varying])::text[])))
);


ALTER TABLE public.leave_type_conversions OWNER TO sky;

--
-- TOC entry 238 (class 1259 OID 46303)
-- Name: leave_type_conversions_id_seq; Type: SEQUENCE; Schema: public; Owner: sky
--

CREATE SEQUENCE public.leave_type_conversions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.leave_type_conversions_id_seq OWNER TO sky;

--
-- TOC entry 4040 (class 0 OID 0)
-- Dependencies: 238
-- Name: leave_type_conversions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: sky
--

ALTER SEQUENCE public.leave_type_conversions_id_seq OWNED BY public.leave_type_conversions.id;


--
-- TOC entry 237 (class 1259 OID 46288)
-- Name: leave_type_policies; Type: TABLE; Schema: public; Owner: sky
--

CREATE TABLE public.leave_type_policies (
    id bigint NOT NULL,
    leave_type_id bigint NOT NULL,
    effective_from date NOT NULL,
    effective_to date,
    max_per_request_days numeric(5,2),
    min_duration_days numeric(5,2),
    allow_negative boolean DEFAULT false,
    max_negative_limit_days numeric(5,2),
    annual_limit_days numeric(7,2),
    auto_calculate_end_date boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now(),
    CONSTRAINT ck_policy_step CHECK ((((max_per_request_days IS NULL) OR ((max_per_request_days * (2)::numeric) = floor((max_per_request_days * (2)::numeric)))) AND ((min_duration_days IS NULL) OR ((min_duration_days * (2)::numeric) = floor((min_duration_days * (2)::numeric)))) AND ((max_negative_limit_days IS NULL) OR ((max_negative_limit_days * (2)::numeric) = floor((max_negative_limit_days * (2)::numeric)))) AND ((annual_limit_days IS NULL) OR ((annual_limit_days * (2)::numeric) = floor((annual_limit_days * (2)::numeric))))))
);


ALTER TABLE public.leave_type_policies OWNER TO sky;

--
-- TOC entry 236 (class 1259 OID 46287)
-- Name: leave_type_policies_id_seq; Type: SEQUENCE; Schema: public; Owner: sky
--

CREATE SEQUENCE public.leave_type_policies_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.leave_type_policies_id_seq OWNER TO sky;

--
-- TOC entry 4041 (class 0 OID 0)
-- Dependencies: 236
-- Name: leave_type_policies_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: sky
--

ALTER SEQUENCE public.leave_type_policies_id_seq OWNED BY public.leave_type_policies.id;


--
-- TOC entry 233 (class 1259 OID 46253)
-- Name: leave_types; Type: TABLE; Schema: public; Owner: sky
--

CREATE TABLE public.leave_types (
    id bigint NOT NULL,
    category_id bigint,
    code character varying(50) NOT NULL,
    name character varying(100) NOT NULL,
    requires_document boolean DEFAULT false,
    requires_comp_working_date boolean DEFAULT false,
    is_system boolean DEFAULT false,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.leave_types OWNER TO sky;

--
-- TOC entry 232 (class 1259 OID 46252)
-- Name: leave_types_id_seq; Type: SEQUENCE; Schema: public; Owner: sky
--

CREATE SEQUENCE public.leave_types_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.leave_types_id_seq OWNER TO sky;

--
-- TOC entry 4042 (class 0 OID 0)
-- Dependencies: 232
-- Name: leave_types_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: sky
--

ALTER SEQUENCE public.leave_types_id_seq OWNED BY public.leave_types.id;


--
-- TOC entry 223 (class 1259 OID 17369)
-- Name: refresh_tokens; Type: TABLE; Schema: public; Owner: sky
--

CREATE TABLE public.refresh_tokens (
    id integer NOT NULL,
    user_id integer NOT NULL,
    token_hash character varying(255) NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    is_revoked boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.refresh_tokens OWNER TO sky;

--
-- TOC entry 222 (class 1259 OID 17368)
-- Name: refresh_tokens_id_seq; Type: SEQUENCE; Schema: public; Owner: sky
--

CREATE SEQUENCE public.refresh_tokens_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.refresh_tokens_id_seq OWNER TO sky;

--
-- TOC entry 4043 (class 0 OID 0)
-- Dependencies: 222
-- Name: refresh_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: sky
--

ALTER SEQUENCE public.refresh_tokens_id_seq OWNED BY public.refresh_tokens.id;


--
-- TOC entry 227 (class 1259 OID 32730)
-- Name: user_approvers; Type: TABLE; Schema: public; Owner: sky
--

CREATE TABLE public.user_approvers (
    id integer NOT NULL,
    user_id integer NOT NULL,
    approver_id integer NOT NULL,
    active boolean DEFAULT true,
    created_by integer,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.user_approvers OWNER TO sky;

--
-- TOC entry 226 (class 1259 OID 32729)
-- Name: user_approvers_id_seq; Type: SEQUENCE; Schema: public; Owner: sky
--

CREATE SEQUENCE public.user_approvers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_approvers_id_seq OWNER TO sky;

--
-- TOC entry 4044 (class 0 OID 0)
-- Dependencies: 226
-- Name: user_approvers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: sky
--

ALTER SEQUENCE public.user_approvers_id_seq OWNED BY public.user_approvers.id;


--
-- TOC entry 219 (class 1259 OID 17097)
-- Name: users; Type: TABLE; Schema: public; Owner: sky
--

CREATE TABLE public.users (
    id integer NOT NULL,
    employee_id character varying(50),
    username character varying(255),
    email character varying(255) NOT NULL,
    role public.user_role DEFAULT 'employee'::public.user_role NOT NULL,
    status public.user_status DEFAULT 'inactive'::public.user_status NOT NULL,
    department_id integer,
    "position" character varying(255),
    join_date date,
    activation_token character varying(255),
    activated_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    gender public.user_gender_enum DEFAULT 'male'::public.user_gender_enum NOT NULL,
    official_contract_date date,
    phone_number character varying(20),
    date_of_birth date,
    address character varying(255),
    contract_type public.users_contract_type_enum
);


ALTER TABLE public.users OWNER TO sky;

--
-- TOC entry 4045 (class 0 OID 0)
-- Dependencies: 219
-- Name: COLUMN users.department_id; Type: COMMENT; Schema: public; Owner: sky
--

COMMENT ON COLUMN public.users.department_id IS 'Reference to department the employee belongs to';


--
-- TOC entry 4046 (class 0 OID 0)
-- Dependencies: 219
-- Name: COLUMN users."position"; Type: COMMENT; Schema: public; Owner: sky
--

COMMENT ON COLUMN public.users."position" IS 'Job position/title of the employee';


--
-- TOC entry 4047 (class 0 OID 0)
-- Dependencies: 219
-- Name: COLUMN users.official_contract_date; Type: COMMENT; Schema: public; Owner: sky
--

COMMENT ON COLUMN public.users.official_contract_date IS 'Date when official employment contract starts';


--
-- TOC entry 218 (class 1259 OID 17096)
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: sky
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO sky;

--
-- TOC entry 4048 (class 0 OID 0)
-- Dependencies: 218
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: sky
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- TOC entry 3702 (class 2604 OID 46280)
-- Name: calendar_overrides id; Type: DEFAULT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.calendar_overrides ALTER COLUMN id SET DEFAULT nextval('public.calendar_overrides_id_seq'::regclass);


--
-- TOC entry 3721 (class 2604 OID 46865)
-- Name: comp_balance_transactions id; Type: DEFAULT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.comp_balance_transactions ALTER COLUMN id SET DEFAULT nextval('public.comp_balance_transactions_id_seq'::regclass);


--
-- TOC entry 3718 (class 2604 OID 46825)
-- Name: comp_work_requests id; Type: DEFAULT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.comp_work_requests ALTER COLUMN id SET DEFAULT nextval('public.comp_work_requests_id_seq'::regclass);


--
-- TOC entry 3658 (class 2604 OID 17087)
-- Name: departments id; Type: DEFAULT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.departments ALTER COLUMN id SET DEFAULT nextval('public.departments_id_seq'::regclass);


--
-- TOC entry 3679 (class 2604 OID 32698)
-- Name: email_queue id; Type: DEFAULT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.email_queue ALTER COLUMN id SET DEFAULT nextval('public.email_queue_id_seq'::regclass);


--
-- TOC entry 3713 (class 2604 OID 46350)
-- Name: leave_balance_transactions id; Type: DEFAULT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.leave_balance_transactions ALTER COLUMN id SET DEFAULT nextval('public.leave_balance_transactions_id_seq'::regclass);


--
-- TOC entry 3693 (class 2604 OID 46245)
-- Name: leave_categories id; Type: DEFAULT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.leave_categories ALTER COLUMN id SET DEFAULT nextval('public.leave_categories_id_seq'::regclass);


--
-- TOC entry 3715 (class 2604 OID 46386)
-- Name: leave_request_attachments id; Type: DEFAULT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.leave_request_attachments ALTER COLUMN id SET DEFAULT nextval('public.leave_request_attachments_id_seq'::regclass);


--
-- TOC entry 3711 (class 2604 OID 46328)
-- Name: leave_request_items id; Type: DEFAULT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.leave_request_items ALTER COLUMN id SET DEFAULT nextval('public.leave_request_items_id_seq'::regclass);


--
-- TOC entry 3690 (class 2604 OID 32755)
-- Name: leave_request_notification_recipients id; Type: DEFAULT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.leave_request_notification_recipients ALTER COLUMN id SET DEFAULT nextval('public.leave_request_notification_recipients_id_seq'::regclass);


--
-- TOC entry 3667 (class 2604 OID 17148)
-- Name: leave_requests id; Type: DEFAULT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.leave_requests ALTER COLUMN id SET DEFAULT nextval('public.leave_requests_id_seq'::regclass);


--
-- TOC entry 3708 (class 2604 OID 46307)
-- Name: leave_type_conversions id; Type: DEFAULT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.leave_type_conversions ALTER COLUMN id SET DEFAULT nextval('public.leave_type_conversions_id_seq'::regclass);


--
-- TOC entry 3704 (class 2604 OID 46291)
-- Name: leave_type_policies id; Type: DEFAULT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.leave_type_policies ALTER COLUMN id SET DEFAULT nextval('public.leave_type_policies_id_seq'::regclass);


--
-- TOC entry 3696 (class 2604 OID 46256)
-- Name: leave_types id; Type: DEFAULT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.leave_types ALTER COLUMN id SET DEFAULT nextval('public.leave_types_id_seq'::regclass);


--
-- TOC entry 3676 (class 2604 OID 17372)
-- Name: refresh_tokens id; Type: DEFAULT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.refresh_tokens ALTER COLUMN id SET DEFAULT nextval('public.refresh_tokens_id_seq'::regclass);


--
-- TOC entry 3687 (class 2604 OID 32733)
-- Name: user_approvers id; Type: DEFAULT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.user_approvers ALTER COLUMN id SET DEFAULT nextval('public.user_approvers_id_seq'::regclass);


--
-- TOC entry 3661 (class 2604 OID 17100)
-- Name: users id; Type: DEFAULT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- TOC entry 4006 (class 0 OID 46277)
-- Dependencies: 235
-- Data for Name: calendar_overrides; Type: TABLE DATA; Schema: public; Owner: sky
--

COPY public.calendar_overrides (id, date, type, name, year, created_at) FROM stdin;
\.


--
-- TOC entry 4020 (class 0 OID 46862)
-- Dependencies: 249
-- Data for Name: comp_balance_transactions; Type: TABLE DATA; Schema: public; Owner: sky
--

COPY public.comp_balance_transactions (id, employee_id, direction, amount_minutes, source_type, source_id, note, created_at) FROM stdin;
\.


--
-- TOC entry 4018 (class 0 OID 46822)
-- Dependencies: 247
-- Data for Name: comp_work_requests; Type: TABLE DATA; Schema: public; Owner: sky
--

COPY public.comp_work_requests (id, employee_id, work_date, start_time, end_time, duration_minutes, status, approver_id, approved_at, rejected_reason, created_at) FROM stdin;
\.


--
-- TOC entry 3988 (class 0 OID 17084)
-- Dependencies: 217
-- Data for Name: departments; Type: TABLE DATA; Schema: public; Owner: sky
--

COPY public.departments (id, name, leader_id, created_at, updated_at) FROM stdin;
8	EMAIL_SERVICE	\N	2026-02-12 07:34:15.476775	2026-02-12 07:34:15.476775
9	RND_CENTER	\N	2026-02-12 07:34:15.476775	2026-02-12 07:34:15.476775
10	MARKETING	\N	2026-02-12 07:34:15.476775	2026-02-12 07:34:15.476775
11	SALES_SUPPORT	\N	2026-02-12 07:34:15.476775	2026-02-12 07:34:15.476775
12	SALES_SOLUTION	\N	2026-02-12 07:34:15.476775	2026-02-12 07:34:15.476775
14	TECH_SUPPORT	\N	2026-02-12 07:34:15.476775	2026-02-12 07:34:15.476775
16	EXECUTIVE_OFFICE	\N	2026-02-12 07:34:15.476775	2026-02-12 09:08:02.680696
7	ACCOUNTING	\N	2026-02-12 07:34:15.476775	2026-02-24 04:24:30.621249
15	TECH_DEV_CENTER	\N	2026-02-12 07:34:15.476775	2026-02-24 04:27:16.09537
6	HR_ADMIN	\N	2026-02-12 07:31:45.42269	2026-02-24 07:34:44.154193
13	FULFILLMENT	\N	2026-02-12 07:34:15.476775	2026-02-25 06:19:46.963597
\.


--
-- TOC entry 3996 (class 0 OID 32695)
-- Dependencies: 225
-- Data for Name: email_queue; Type: TABLE DATA; Schema: public; Owner: sky
--

COPY public.email_queue (id, recipient_user_id, type, reference_kind, reference_id, idempotency_key, context, status, attempt_count, max_attempts, next_retry_at, processing_started_at, worker_id, sent_at, failed_at, cancelled_at, skipped_at, error_message, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 4014 (class 0 OID 46347)
-- Dependencies: 243
-- Data for Name: leave_balance_transactions; Type: TABLE DATA; Schema: public; Owner: sky
--

COPY public.leave_balance_transactions (id, employee_id, leave_type_id, period_year, period_month, direction, amount_days, source_type, source_id, note, created_at) FROM stdin;
\.


--
-- TOC entry 4002 (class 0 OID 46242)
-- Dependencies: 231
-- Data for Name: leave_categories; Type: TABLE DATA; Schema: public; Owner: sky
--

COPY public.leave_categories (id, code, name, is_active, created_at) FROM stdin;
\.


--
-- TOC entry 4016 (class 0 OID 46383)
-- Dependencies: 245
-- Data for Name: leave_request_attachments; Type: TABLE DATA; Schema: public; Owner: sky
--

COPY public.leave_request_attachments (id, leave_request_id, original_filename, content_type, size_bytes, storage_provider, bucket, object_key, uploaded_by, created_at) FROM stdin;
\.


--
-- TOC entry 4012 (class 0 OID 46325)
-- Dependencies: 241
-- Data for Name: leave_request_items; Type: TABLE DATA; Schema: public; Owner: sky
--

COPY public.leave_request_items (id, leave_request_id, leave_type_id, amount_days, note, created_at) FROM stdin;
\.


--
-- TOC entry 4000 (class 0 OID 32752)
-- Dependencies: 229
-- Data for Name: leave_request_notification_recipients; Type: TABLE DATA; Schema: public; Owner: sky
--

COPY public.leave_request_notification_recipients (id, request_id, user_id, type, created_at) FROM stdin;
69	44	60	CC	2026-02-24 09:55:13.237735+00
\.


--
-- TOC entry 3992 (class 0 OID 17145)
-- Dependencies: 221
-- Data for Name: leave_requests; Type: TABLE DATA; Schema: public; Owner: sky
--

COPY public.leave_requests (id, user_id, reason, start_date, end_date, start_session, end_session, duration, status, approver_id, approved_at, rejected_reason, cancelled_at, created_at, updated_at, version, rejected_at, work_solution, duration_days, requested_leave_type_id, use_comp_balance, comp_used_minutes) FROM stdin;
42	61	ff  ưeeedd	2026-02-28	2026-02-28	AM	PM	\N	pending	55	\N	\N	\N	2026-02-24 07:21:02.512736+00	2026-02-26 03:10:53.412492+00	2	\N	ffffe  eee	\N	\N	f	0
43	61	đi du xuân	2026-03-02	2026-03-02	AM	PM	\N	approved	55	2026-02-24 08:44:50.131+00	\N	\N	2026-02-24 08:19:38.348035+00	2026-02-26 03:10:53.412492+00	2	\N	làm bù	\N	\N	f	0
44	61	adsfdadaffffff	2026-03-08	2026-03-08	AM	PM	\N	rejected	55	\N	đàafadsfdasff	\N	2026-02-24 09:53:58.066341+00	2026-02-26 03:10:53.412492+00	3	2026-02-24 09:55:31.529+00		\N	\N	f	0
\.


--
-- TOC entry 4010 (class 0 OID 46304)
-- Dependencies: 239
-- Data for Name: leave_type_conversions; Type: TABLE DATA; Schema: public; Owner: sky
--

COPY public.leave_type_conversions (id, from_leave_type_id, to_leave_type_id, priority, reason, is_active, created_at) FROM stdin;
\.


--
-- TOC entry 4008 (class 0 OID 46288)
-- Dependencies: 237
-- Data for Name: leave_type_policies; Type: TABLE DATA; Schema: public; Owner: sky
--

COPY public.leave_type_policies (id, leave_type_id, effective_from, effective_to, max_per_request_days, min_duration_days, allow_negative, max_negative_limit_days, annual_limit_days, auto_calculate_end_date, created_at) FROM stdin;
\.


--
-- TOC entry 4004 (class 0 OID 46253)
-- Dependencies: 233
-- Data for Name: leave_types; Type: TABLE DATA; Schema: public; Owner: sky
--

COPY public.leave_types (id, category_id, code, name, requires_document, requires_comp_working_date, is_system, is_active, created_at) FROM stdin;
\.


--
-- TOC entry 3994 (class 0 OID 17369)
-- Dependencies: 223
-- Data for Name: refresh_tokens; Type: TABLE DATA; Schema: public; Owner: sky
--

COPY public.refresh_tokens (id, user_id, token_hash, expires_at, is_revoked, created_at) FROM stdin;
351	55	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjU1LCJlbWFpbCI6Im1haWtoYWFuaDExMjA1QGdtYWlsLmNvbSIsInVzZXJuYW1lIjoiS2hhIEVtIiwicm9sZSI6ImVtcGxveWVlIiwiaWF0IjoxNzcwODY3MDIxLCJleHAiOjE3NzE0NzE4MjF9.uFBXEdJzC8pu-0jvSGPi5Cqwq0Ri3gGPZDn3DAAdls4	2026-10-20 11:50:00.125	t	2026-02-12 03:30:21.126975
360	55	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjU1LCJlbWFpbCI6Im1haWtoYWFuaDExMjA1QGdtYWlsLmNvbSIsInVzZXJuYW1lIjoiS2hhIEVtIiwicm9sZSI6ImVtcGxveWVlIiwiaWF0IjoxNzcwODgwODg1LCJleHAiOjE3NzE0ODU2ODV9.57AHUzutmAwo7kxa5ymoWLDpNx-ysC19tn7coJnXeGI	2026-12-05 22:47:40.986	t	2026-02-12 07:21:25.992529
406	61	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjYxLCJlbWFpbCI6ImFuaG1rQHNreXNvbHV0aW9uLmNvbSIsInVzZXJuYW1lIjoiS2hhIEFuaCIsInJvbGUiOiJociIsImlhdCI6MTc3MTkwNzY5MSwiZXhwIjoxNzcyNTEyNDkxfQ.HVBgbXuCZkK4poTT7L3XUUcvo-GKCO5GOnLGs09VqWI	2027-10-14 18:14:00.953	t	2026-02-24 04:34:51.960283
415	61	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjYxLCJlbWFpbCI6ImFuaG1rQHNreXNvbHV0aW9uLmNvbSIsInVzZXJuYW1lIjoiS2hhIEFuaCIsInJvbGUiOiJociIsImlhdCI6MTc3MTkxNjg4MCwiZXhwIjoxNzcyNTIxNjgwfQ.blHSGDoaQEB36lRgOl-mKC961rjq-OdN9jO_hI_PW44	2026-03-03 14:08:00.554	t	2026-02-24 07:08:00.555839
423	61	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjYxLCJlbWFpbCI6ImFuaG1rQHNreXNvbHV0aW9uLmNvbSIsInVzZXJuYW1lIjoiS2hhIEFuaCIsInJvbGUiOiJociIsImlhdCI6MTc3MTkyMDQ1NywiZXhwIjoxNzcyNTI1MjU3fQ.oqYZR-DEj8CnhLIKCbtu1myoWZq-Df_iz-um5up_6jQ	2027-05-05 20:53:40.325	t	2026-02-24 08:07:37.327271
426	61	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjYxLCJlbWFpbCI6ImFuaG1rQHNreXNvbHV0aW9uLmNvbSIsInVzZXJuYW1lIjoiS2hhIEFuaCIsInJvbGUiOiJociIsImlhdCI6MTc3MTkyMjYyNSwiZXhwIjoxNzcyNTI3NDI1fQ.RnwDERoWkERNw0H_Xbns7rBEoXsG-PrRzpJUC_hR-8Q	2027-08-06 11:43:00.346	t	2026-02-24 08:43:45.354611
434	61	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjYxLCJlbWFpbCI6ImFuaG1rQHNreXNvbHV0aW9uLmNvbSIsInVzZXJuYW1lIjoiS2hhIEFuaCIsInJvbGUiOiJociIsImlhdCI6MTc3MTkyNzgwNSwiZXhwIjoxNzcyNTMyNjA1fQ.UqIq4mdUWxaktSGv4A2ylI5Zh9JneRBWDQyb19sDTYA	2026-04-30 14:03:20.859	t	2026-02-24 10:10:05.858731
436	61	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjYxLCJlbWFpbCI6ImFuaG1rQHNreXNvbHV0aW9uLmNvbSIsInVzZXJuYW1lIjoiS2hhIEFuaCIsInJvbGUiOiJociIsImlhdCI6MTc3MjAwMDM2NiwiZXhwIjoxNzcyNjA1MTY2fQ.gFHihN33cc6f6K0kbmz1Vfw5WccyQeu1VfpmVMqGbf0	2026-12-30 11:32:20.299	t	2026-02-25 06:19:26.305474
444	61	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjYxLCJlbWFpbCI6ImFuaG1rQHNreXNvbHV0aW9uLmNvbSIsInVzZXJuYW1lIjoiS2hhIEFuaCIsInJvbGUiOiJociIsImlhdCI6MTc3MjA3MTYzNiwiZXhwIjoxNzcyNjc2NDM2fQ.XtE6BOLnMyAHLEIXQxAtOhLFizE37clc1ufAGjjpRJY	2026-09-06 13:33:40.838	f	2026-02-26 02:07:16.843646
407	60	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjYwLCJlbWFpbCI6IjIzMDIwMDA2QHZudS5lZHUudm4iLCJ1c2VybmFtZSI6IjIzMDIwMDA2Iiwicm9sZSI6ImVtcGxveWVlIiwiaWF0IjoxNzcxOTA3NzU1LCJleHAiOjE3NzI1MTI1NTV9.fClPglQpEu-wBDXDMcWwt9lEh__x5gfmFyG9YRUGyd0	2027-11-30 01:21:40.581	t	2026-02-24 04:35:55.582333
416	60	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjYwLCJlbWFpbCI6IjIzMDIwMDA2QHZudS5lZHUudm4iLCJ1c2VybmFtZSI6IjIzMDIwMDA2Iiwicm9sZSI6ImVtcGxveWVlIiwiaWF0IjoxNzcxOTE3Mjk2LCJleHAiOjE3NzI1MjIwOTZ9.1ZacS_kzYa_HKGAWlxrqNgzxuMwDi_rLjx3LRX1G3Mc	2027-12-11 17:47:20.901	t	2026-02-24 07:14:56.899521
424	55	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjU1LCJlbWFpbCI6Im1haWtoYWFuaDExMjA1QGdtYWlsLmNvbSIsInVzZXJuYW1lIjoiS2hhIEVtIiwicm9sZSI6ImhyIiwiaWF0IjoxNzcxOTIwNTIyLCJleHAiOjE3NzI1MjUzMjJ9.WFUtugYfv_NpSo5Whqw4jX2Q-WjfX-RKBbPG6EU1k14	2027-07-02 17:48:00.461	t	2026-02-24 08:08:42.463901
427	55	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjU1LCJlbWFpbCI6Im1haWtoYWFuaDExMjA1QGdtYWlsLmNvbSIsInVzZXJuYW1lIjoiS2hhIEVtIiwicm9sZSI6ImhyIiwiaWF0IjoxNzcxOTIyNjgzLCJleHAiOjE3NzI1Mjc0ODN9.phulbp77a3yPn6wCZSOLBNDvuoK9hPu24-M1epwm0wA	2027-07-14 08:10:40.922	t	2026-02-24 08:44:43.927315
435	61	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjYxLCJlbWFpbCI6ImFuaG1rQHNreXNvbHV0aW9uLmNvbSIsInVzZXJuYW1lIjoiS2hhIEFuaCIsInJvbGUiOiJociIsImlhdCI6MTc3MTkyODAzNSwiZXhwIjoxNzcyNTMyODM1fQ.Z-E7r4uDJb7g0o5Xes857AxShVZvQaXImoeew-4BeX0	2027-11-30 06:59:40.238	t	2026-02-24 10:13:55.246045
361	55	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjU1LCJlbWFpbCI6Im1haWtoYWFuaDExMjA1QGdtYWlsLmNvbSIsInVzZXJuYW1lIjoiS2hhIEVtIiwicm9sZSI6ImVtcGxveWVlIiwiaWF0IjoxNzcwODgxNzIwLCJleHAiOjE3NzE0ODY1MjB9.Pnf_oYacwH3nOODppymaLeTMACp-EuKnkHUrVeApPhI	2026-10-09 02:08:20.407	t	2026-02-12 07:35:20.409271
437	61	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjYxLCJlbWFpbCI6ImFuaG1rQHNreXNvbHV0aW9uLmNvbSIsInVzZXJuYW1lIjoiS2hhIEFuaCIsInJvbGUiOiJociIsImlhdCI6MTc3MjAxMDI5OSwiZXhwIjoxNzcyNjE1MDk5fQ.r1E7PdysLE-Qgg5513j_jGCyCbSrPyAWq88jh5Rx83s	2028-01-16 12:57:20.478	t	2026-02-25 09:04:59.485928
445	61	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjYxLCJlbWFpbCI6ImFuaG1rQHNreXNvbHV0aW9uLmNvbSIsInVzZXJuYW1lIjoiS2hhIEFuaCIsInJvbGUiOiJociIsImlhdCI6MTc3MjA3MjM4MSwiZXhwIjoxNzcyNjc3MTgxfQ.qhsm6xFZ5hzJr1zZIO7TYNkkAmXAEHvBrDE8bR52Rtk	2027-06-22 22:12:20.948	t	2026-02-26 02:19:41.950175
353	55	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjU1LCJlbWFpbCI6Im1haWtoYWFuaDExMjA1QGdtYWlsLmNvbSIsInVzZXJuYW1lIjoiS2hhIEVtIiwicm9sZSI6ImVtcGxveWVlIiwiaWF0IjoxNzcwODY3MTg3LCJleHAiOjE3NzE0NzE5ODd9.T3tF9hW1Mpf4mQWjJh8pC7ECg4nPdWZqBEX3yY4QKIM	2026-05-11 10:59:40.994	t	2026-02-12 03:33:07.995474
408	61	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjYxLCJlbWFpbCI6ImFuaG1rQHNreXNvbHV0aW9uLmNvbSIsInVzZXJuYW1lIjoiS2hhIEFuaCIsInJvbGUiOiJociIsImlhdCI6MTc3MTkwODE0OSwiZXhwIjoxNzcyNTEyOTQ5fQ.zolhqyY5vujwgLcp3T6oHHt6wWwA6mJdu6Dwq_WEhwA	2027-02-02 03:15:20.541	t	2026-02-24 04:42:29.542302
417	60	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjYwLCJlbWFpbCI6IjIzMDIwMDA2QHZudS5lZHUudm4iLCJ1c2VybmFtZSI6IjIzMDIwMDA2Iiwicm9sZSI6ImVtcGxveWVlIiwiaWF0IjoxNzcxOTE3Mjk2LCJleHAiOjE3NzI1MjIwOTZ9.1ZacS_kzYa_HKGAWlxrqNgzxuMwDi_rLjx3LRX1G3Mc	2027-12-11 17:47:20.901	f	2026-02-24 07:14:56.899745
425	61	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjYxLCJlbWFpbCI6ImFuaG1rQHNreXNvbHV0aW9uLmNvbSIsInVzZXJuYW1lIjoiS2hhIEFuaCIsInJvbGUiOiJociIsImlhdCI6MTc3MTkyMTU2MywiZXhwIjoxNzcyNTI2MzYzfQ.tgBqwfUZOTLUkMEuVaLLkyZ3BPfmn2dHa2Hv3IQjBbA	2026-04-07 08:46:00.407	t	2026-02-24 08:26:03.407934
428	61	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjYxLCJlbWFpbCI6ImFuaG1rQHNreXNvbHV0aW9uLmNvbSIsInVzZXJuYW1lIjoiS2hhIEFuaCIsInJvbGUiOiJociIsImlhdCI6MTc3MTkyMzUwMSwiZXhwIjoxNzcyNTI4MzAxfQ.UoL_1pJedC9CELs0y7UvbJqg223fCNi5rVYnCTZ1Su8	2026-11-01 17:18:00.127	t	2026-02-24 08:58:21.135345
362	55	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjU1LCJlbWFpbCI6Im1haWtoYWFuaDExMjA1QGdtYWlsLmNvbSIsInVzZXJuYW1lIjoiS2hhIEVtIiwicm9sZSI6ImVtcGxveWVlIiwiaWF0IjoxNzcwODgxNzc2LCJleHAiOjE3NzE0ODY1NzZ9.8kf30yPir-bEco7ZkZZlNRk4-WM8cCt5RNSCCklTWf8	2026-08-23 19:02:40.713	t	2026-02-12 07:36:16.718554
438	61	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjYxLCJlbWFpbCI6ImFuaG1rQHNreXNvbHV0aW9uLmNvbSIsInVzZXJuYW1lIjoiS2hhIEFuaCIsInJvbGUiOiJociIsImlhdCI6MTc3MjAxMTIwMiwiZXhwIjoxNzcyNjE2MDAyfQ.o9d-bZn5A_te9KOmYsCwJEn3OduQVDwaG5jTdD5z4i0	2026-03-27 19:53:20.495	t	2026-02-25 09:20:02.496904
446	61	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjYxLCJlbWFpbCI6ImFuaG1rQHNreXNvbHV0aW9uLmNvbSIsInVzZXJuYW1lIjoiS2hhIEFuaCIsInJvbGUiOiJociIsImlhdCI6MTc3MjA3MzMwMiwiZXhwIjoxNzcyNjc4MTAyfQ.oItYW2q6mLxaG7r7c3ynVd9Snfvuxv5JKQsqWqY9Qrw	2026-03-28 13:08:20.355	t	2026-02-26 02:35:02.356343
409	61	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjYxLCJlbWFpbCI6ImFuaG1rQHNreXNvbHV0aW9uLmNvbSIsInVzZXJuYW1lIjoiS2hhIEFuaCIsInJvbGUiOiJociIsImlhdCI6MTc3MTkxMjA3MywiZXhwIjoxNzcyNTE2ODczfQ.nt4S-NV8clT1Jbbr9P8JB5DMfadEHYrdLCgVeX_L64Y	2027-11-06 23:00:20.136	t	2026-02-24 05:47:53.140885
418	60	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjYwLCJlbWFpbCI6IjIzMDIwMDA2QHZudS5lZHUudm4iLCJ1c2VybmFtZSI6IjIzMDIwMDA2Iiwicm9sZSI6ImVtcGxveWVlIiwiaWF0IjoxNzcxOTE3Mjk2LCJleHAiOjE3NzI1MjIwOTZ9.1ZacS_kzYa_HKGAWlxrqNgzxuMwDi_rLjx3LRX1G3Mc	2027-12-11 17:47:20.903	f	2026-02-24 07:14:56.901418
429	61	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjYxLCJlbWFpbCI6ImFuaG1rQHNreXNvbHV0aW9uLmNvbSIsInVzZXJuYW1lIjoiS2hhIEFuaCIsInJvbGUiOiJociIsImlhdCI6MTc3MTkyNDgxOCwiZXhwIjoxNzcyNTI5NjE4fQ.-egzMHcXLsWBnkU0qvjXwCRJrqGt2pjj3EY8zDgBA7c	2026-09-28 00:20:00.614	t	2026-02-24 09:20:18.614853
439	61	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjYxLCJlbWFpbCI6ImFuaG1rQHNreXNvbHV0aW9uLmNvbSIsInVzZXJuYW1lIjoiS2hhIEFuaCIsInJvbGUiOiJociIsImlhdCI6MTc3MjAxMTIwMiwiZXhwIjoxNzcyNjE2MDAyfQ.o9d-bZn5A_te9KOmYsCwJEn3OduQVDwaG5jTdD5z4i0	2026-03-27 19:53:20.497	f	2026-02-25 09:20:02.4991
447	61	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjYxLCJlbWFpbCI6ImFuaG1rQHNreXNvbHV0aW9uLmNvbSIsInVzZXJuYW1lIjoiS2hhIEFuaCIsInJvbGUiOiJociIsImlhdCI6MTc3MjA3NzU3MywiZXhwIjoxNzcyNjgyMzczfQ.2oxPr2N9pk6ejZ7ATpLN4XHn544vDGf52na9euc11Kc	2026-08-02 21:52:40.27	f	2026-02-26 03:46:13.275455
354	55	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjU1LCJlbWFpbCI6Im1haWtoYWFuaDExMjA1QGdtYWlsLmNvbSIsInVzZXJuYW1lIjoiS2hhIEVtIiwicm9sZSI6ImVtcGxveWVlIiwiaWF0IjoxNzcwODY3MzU2LCJleHAiOjE3NzE0NzIxNTZ9.5F77xi5LCbLVA6tJNWBqkafY0QRKrAS8bjrnRupeYTc	2027-11-29 14:08:20.121	t	2026-02-12 03:35:56.122024
363	55	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjU1LCJlbWFpbCI6Im1haWtoYWFuaDExMjA1QGdtYWlsLmNvbSIsInVzZXJuYW1lIjoiS2hhIEVtIiwicm9sZSI6ImVtcGxveWVlIiwiaWF0IjoxNzcwODgxOTAyLCJleHAiOjE3NzE0ODY3MDJ9.eCrKlHc2bxJ2INOHNcliH6aXJKjzBLpOEFnevNV4vIk	2026-11-01 05:44:40.343	t	2026-02-12 07:38:22.344511
364	55	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjU1LCJlbWFpbCI6Im1haWtoYWFuaDExMjA1QGdtYWlsLmNvbSIsInVzZXJuYW1lIjoiS2hhIEVtIiwicm9sZSI6ImVtcGxveWVlIiwiaWF0IjoxNzcwODgxOTI1LCJleHAiOjE3NzE0ODY3MjV9.WaPlPnFv5TEP0eZo1eYjPzGJauzKZbxcFDphcyXukNo	2027-07-25 10:38:00.723	t	2026-02-12 07:38:45.724523
405	55	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjU1LCJlbWFpbCI6Im1haWtoYWFuaDExMjA1QGdtYWlsLmNvbSIsInVzZXJuYW1lIjoiS2hhIEVtIiwicm9sZSI6ImhyIiwiaWF0IjoxNzcxOTA3MjYxLCJleHAiOjE3NzI1MTIwNjF9.H2l61j4iPOn4yhObcTcSApqXJ-0FDisSWkNqCzTwhts	2027-06-21 00:20:20.443	t	2026-02-24 04:27:41.445191
410	60	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjYwLCJlbWFpbCI6IjIzMDIwMDA2QHZudS5lZHUudm4iLCJ1c2VybmFtZSI6IjIzMDIwMDA2Iiwicm9sZSI6ImVtcGxveWVlIiwiaWF0IjoxNzcxOTEyMDg2LCJleHAiOjE3NzI1MTY4ODZ9.rJlUAqi93fyoYnXPGH0lF0P8dnFgYeyZVq78F2EdE3c	2026-05-11 23:28:00.096	t	2026-02-24 05:48:06.10238
419	61	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjYxLCJlbWFpbCI6ImFuaG1rQHNreXNvbHV0aW9uLmNvbSIsInVzZXJuYW1lIjoiS2hhIEFuaCIsInJvbGUiOiJociIsImlhdCI6MTc3MTkxODA0NiwiZXhwIjoxNzcyNTIyODQ2fQ.jy_9S3t_BpsZ1Dr6KFk1GHuh12FqfHkay3xfQ5Y5Kvs	2026-12-29 12:40:20.969	t	2026-02-24 07:27:26.972745
430	61	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjYxLCJlbWFpbCI6ImFuaG1rQHNreXNvbHV0aW9uLmNvbSIsInVzZXJuYW1lIjoiS2hhIEFuaCIsInJvbGUiOiJociIsImlhdCI6MTc3MTkyNTk5OSwiZXhwIjoxNzcyNTMwNzk5fQ.U4JIdKJwQObJ5AnpcwfzuyHt_byvL6MoUHLQZEW8q7g	2028-01-15 13:32:20.546	t	2026-02-24 09:39:59.550475
440	61	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjYxLCJlbWFpbCI6ImFuaG1rQHNreXNvbHV0aW9uLmNvbSIsInVzZXJuYW1lIjoiS2hhIEFuaCIsInJvbGUiOiJociIsImlhdCI6MTc3MjAxMzk0MCwiZXhwIjoxNzcyNjE4NzQwfQ.XQZeHfq38sBLqDXhqaqcOOUAJatVhcr4IDLctHWwxwg	2027-06-22 05:58:20.002	f	2026-02-25 10:05:41.001668
386	55	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjU1LCJlbWFpbCI6Im1haWtoYWFuaDExMjA1QGdtYWlsLmNvbSIsInVzZXJuYW1lIjoiS2hhIEVtIiwicm9sZSI6ImVtcGxveWVlIiwiaWF0IjoxNzcwOTU1MDExLCJleHAiOjE3NzE1NTk4MTF9.fGfdeLvniUcftjRDS-4JTKbvjP6WoNtqy42ykHNXm8M	2027-10-03 17:36:00.627	t	2026-02-13 03:56:51.62858
387	55	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjU1LCJlbWFpbCI6Im1haWtoYWFuaDExMjA1QGdtYWlsLmNvbSIsInVzZXJuYW1lIjoiS2hhIEVtIiwicm9sZSI6ImhyIiwiaWF0IjoxNzcwOTU1NDI0LCJleHAiOjE3NzE1NjAyMjR9.nNPOVi4uqXH6649_9hVXX5iAPmZ6wem9zZSmt-AV804	2027-07-14 17:16:20.515	t	2026-02-13 04:03:44.516861
411	61	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjYxLCJlbWFpbCI6ImFuaG1rQHNreXNvbHV0aW9uLmNvbSIsInVzZXJuYW1lIjoiS2hhIEFuaCIsInJvbGUiOiJociIsImlhdCI6MTc3MTkxMzUyNSwiZXhwIjoxNzcyNTE4MzI1fQ.7dKAfx-3NcP3sepoelYclCeMWrMT__Twn7fUVFOVKis	2026-04-30 10:05:20.157	t	2026-02-24 06:12:05.160708
420	60	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjYwLCJlbWFpbCI6IjIzMDIwMDA2QHZudS5lZHUudm4iLCJ1c2VybmFtZSI6IjIzMDIwMDA2Iiwicm9sZSI6ImVtcGxveWVlIiwiaWF0IjoxNzcxOTE4MjIxLCJleHAiOjE3NzI1MjMwMjF9.e1Ci1_4z5mFA5VHtM2QejBADWMhpkRFihbMmkjodm3k	2026-11-01 15:50:00.518	f	2026-02-24 07:30:21.522446
431	61	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjYxLCJlbWFpbCI6ImFuaG1rQHNreXNvbHV0aW9uLmNvbSIsInVzZXJuYW1lIjoiS2hhIEFuaCIsInJvbGUiOiJociIsImlhdCI6MTc3MTkyNjU2MywiZXhwIjoxNzcyNTMxMzYzfQ.WwGhhLcf0w_mb9V2K7lFxFqqNsgFgl4mvCHMyjGMBmI	2026-11-24 21:42:20.697	t	2026-02-24 09:49:23.701517
441	61	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjYxLCJlbWFpbCI6ImFuaG1rQHNreXNvbHV0aW9uLmNvbSIsInVzZXJuYW1lIjoiS2hhIEFuaCIsInJvbGUiOiJociIsImlhdCI6MTc3MjAxMzk0MSwiZXhwIjoxNzcyNjE4NzQxfQ.ektTo_UtLCKtx_-BNksGo5Nz0AmZLUN10dT37XIdO74	2027-06-22 05:58:20.006	t	2026-02-25 10:05:41.003714
412	61	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjYxLCJlbWFpbCI6ImFuaG1rQHNreXNvbHV0aW9uLmNvbSIsInVzZXJuYW1lIjoiS2hhIEFuaCIsInJvbGUiOiJociIsImlhdCI6MTc3MTkxNDQyNiwiZXhwIjoxNzcyNTE5MjI2fQ.ZZkzoSM6mE0WHCwbZE1jTPFFq4mH9mXd-9c1GpzASQY	2026-05-12 00:07:00.724	t	2026-02-24 06:27:06.729225
421	61	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjYxLCJlbWFpbCI6ImFuaG1rQHNreXNvbHV0aW9uLmNvbSIsInVzZXJuYW1lIjoiS2hhIEFuaCIsInJvbGUiOiJociIsImlhdCI6MTc3MTkxOTQ0NiwiZXhwIjoxNzcyNTI0MjQ2fQ.MXbonkT2zMMuAvZ-ad8vcAza9eFYA_HzT6x6UYjxyuQ	2027-08-18 00:36:40.979	t	2026-02-24 07:50:46.983078
432	55	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjU1LCJlbWFpbCI6Im1haWtoYWFuaDExMjA1QGdtYWlsLmNvbSIsInVzZXJuYW1lIjoiS2hhIEVtIiwicm9sZSI6ImhyIiwiaWF0IjoxNzcxOTI2ODg3LCJleHAiOjE3NzI1MzE2ODd9.T6720gDOPGPQmuRGT9IIRisaQiIB_mq4peTccibtykk	2027-08-29 16:27:20.149	t	2026-02-24 09:54:47.150131
442	61	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjYxLCJlbWFpbCI6ImFuaG1rQHNreXNvbHV0aW9uLmNvbSIsInVzZXJuYW1lIjoiS2hhIEFuaCIsInJvbGUiOiJociIsImlhdCI6MTc3MjAxNDkwMywiZXhwIjoxNzcyNjE5NzAzfQ.FiHBW9-EX3b60Yp5gcfyfp9yzIiZSUjujS5rdtSUkeU	2027-07-15 09:47:40.917	t	2026-02-25 10:21:43.922257
414	61	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjYxLCJlbWFpbCI6ImFuaG1rQHNreXNvbHV0aW9uLmNvbSIsInVzZXJuYW1lIjoiS2hhIEFuaCIsInJvbGUiOiJociIsImlhdCI6MTc3MTkxNDQ3NCwiZXhwIjoxNzcyNTE5Mjc0fQ.j1SVnD6CP_lbg9PMr97AKUNSA5vHPhhA9EAnDnGkBT8	2027-11-18 13:27:00.219	t	2026-02-24 06:27:54.222345
422	61	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjYxLCJlbWFpbCI6ImFuaG1rQHNreXNvbHV0aW9uLmNvbSIsInVzZXJuYW1lIjoiS2hhIEFuaCIsInJvbGUiOiJociIsImlhdCI6MTc3MTkyMDQwNCwiZXhwIjoxNzcyNTI1MjA0fQ.97dr5hpkOhXvhxkNHu3aoqRmWfRhBzePj59qB9scxw4	2027-07-25 21:19:20.284	t	2026-02-24 08:06:44.286703
433	61	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjYxLCJlbWFpbCI6ImFuaG1rQHNreXNvbHV0aW9uLmNvbSIsInVzZXJuYW1lIjoiS2hhIEFuaCIsInJvbGUiOiJociIsImlhdCI6MTc3MTkyNzc4OSwiZXhwIjoxNzcyNTMyNTg5fQ.39g-I0OrovUw3upSPLVgwTnLSK5cFtrT8FYE8ztf6sQ	2027-09-21 20:15:40.598	t	2026-02-24 10:09:49.5986
443	55	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjU1LCJlbWFpbCI6Im1haWtoYWFuaDExMjA1QGdtYWlsLmNvbSIsInVzZXJuYW1lIjoiS2hhIEVtIiwicm9sZSI6ImhyIiwiaWF0IjoxNzcyMDE0OTE3LCJleHAiOjE3NzI2MTk3MTd9.UN78j91rd8n3jfTQKWcOFfMVrZVmzS-1sz8zdQMfm_U	2027-12-24 10:41:00.899	t	2026-02-25 10:21:57.900941
368	55	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjU1LCJlbWFpbCI6Im1haWtoYWFuaDExMjA1QGdtYWlsLmNvbSIsInVzZXJuYW1lIjoiS2hhIEVtIiwicm9sZSI6ImhyIiwiaWF0IjoxNzcwODg0OTE3LCJleHAiOjE3NzE0ODk3MTd9._RiLezhmzChV7pQgntKCGs6FTEMXAkt21UAK14V6jAE	2027-04-23 21:14:40.76	t	2026-02-12 08:28:37.760936
\.


--
-- TOC entry 3998 (class 0 OID 32730)
-- Dependencies: 227
-- Data for Name: user_approvers; Type: TABLE DATA; Schema: public; Owner: sky
--

COPY public.user_approvers (id, user_id, approver_id, active, created_by, created_at) FROM stdin;
20	61	55	t	\N	2026-02-24 04:28:53.783459+00
21	60	61	t	\N	2026-02-24 07:18:09.799844+00
\.


--
-- TOC entry 3990 (class 0 OID 17097)
-- Dependencies: 219
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: sky
--

COPY public.users (id, employee_id, username, email, role, status, department_id, "position", join_date, activation_token, activated_at, created_at, updated_at, gender, official_contract_date, phone_number, date_of_birth, address, contract_type) FROM stdin;
61	EM12365	Kha Anh	anhmk@skysolution.com	hr	active	15	Backend Intern	2026-02-12	\N	2026-02-24 11:34:41.909	2026-02-24 04:28:53.783459	2026-02-24 07:17:12.646481	male	\N	0914287716	2005-12-01	an lá 2	probation
60	EM123	23020006	23020006@vnu.edu.vn	employee	active	\N	student	2026-02-20	\N	2026-02-24 11:35:45.773	2026-02-24 04:25:51.324712	2026-02-24 07:18:09.799844	male	2026-02-13	287716	2026-02-17	Ky tuc xa My Dinh	full_time
55	MAI122	Kha Em	maikhaanh11205@gmail.com	hr	active	6	Software Engineer	2025-12-30	\N	2026-02-12 10:30:15.455	2026-02-12 03:29:58.757355	2026-02-22 19:47:55.853032	male	2026-01-15	\N	\N	\N	\N
\.


--
-- TOC entry 4049 (class 0 OID 0)
-- Dependencies: 234
-- Name: calendar_overrides_id_seq; Type: SEQUENCE SET; Schema: public; Owner: sky
--

SELECT pg_catalog.setval('public.calendar_overrides_id_seq', 1, false);


--
-- TOC entry 4050 (class 0 OID 0)
-- Dependencies: 248
-- Name: comp_balance_transactions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: sky
--

SELECT pg_catalog.setval('public.comp_balance_transactions_id_seq', 1, false);


--
-- TOC entry 4051 (class 0 OID 0)
-- Dependencies: 246
-- Name: comp_work_requests_id_seq; Type: SEQUENCE SET; Schema: public; Owner: sky
--

SELECT pg_catalog.setval('public.comp_work_requests_id_seq', 1, false);


--
-- TOC entry 4052 (class 0 OID 0)
-- Dependencies: 216
-- Name: departments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: sky
--

SELECT pg_catalog.setval('public.departments_id_seq', 16, true);


--
-- TOC entry 4053 (class 0 OID 0)
-- Dependencies: 224
-- Name: email_queue_id_seq; Type: SEQUENCE SET; Schema: public; Owner: sky
--

SELECT pg_catalog.setval('public.email_queue_id_seq', 132, true);


--
-- TOC entry 4054 (class 0 OID 0)
-- Dependencies: 242
-- Name: leave_balance_transactions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: sky
--

SELECT pg_catalog.setval('public.leave_balance_transactions_id_seq', 1, false);


--
-- TOC entry 4055 (class 0 OID 0)
-- Dependencies: 230
-- Name: leave_categories_id_seq; Type: SEQUENCE SET; Schema: public; Owner: sky
--

SELECT pg_catalog.setval('public.leave_categories_id_seq', 1, false);


--
-- TOC entry 4056 (class 0 OID 0)
-- Dependencies: 244
-- Name: leave_request_attachments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: sky
--

SELECT pg_catalog.setval('public.leave_request_attachments_id_seq', 1, false);


--
-- TOC entry 4057 (class 0 OID 0)
-- Dependencies: 240
-- Name: leave_request_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: sky
--

SELECT pg_catalog.setval('public.leave_request_items_id_seq', 1, false);


--
-- TOC entry 4058 (class 0 OID 0)
-- Dependencies: 228
-- Name: leave_request_notification_recipients_id_seq; Type: SEQUENCE SET; Schema: public; Owner: sky
--

SELECT pg_catalog.setval('public.leave_request_notification_recipients_id_seq', 69, true);


--
-- TOC entry 4059 (class 0 OID 0)
-- Dependencies: 220
-- Name: leave_requests_id_seq; Type: SEQUENCE SET; Schema: public; Owner: sky
--

SELECT pg_catalog.setval('public.leave_requests_id_seq', 44, true);


--
-- TOC entry 4060 (class 0 OID 0)
-- Dependencies: 238
-- Name: leave_type_conversions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: sky
--

SELECT pg_catalog.setval('public.leave_type_conversions_id_seq', 1, false);


--
-- TOC entry 4061 (class 0 OID 0)
-- Dependencies: 236
-- Name: leave_type_policies_id_seq; Type: SEQUENCE SET; Schema: public; Owner: sky
--

SELECT pg_catalog.setval('public.leave_type_policies_id_seq', 1, false);


--
-- TOC entry 4062 (class 0 OID 0)
-- Dependencies: 232
-- Name: leave_types_id_seq; Type: SEQUENCE SET; Schema: public; Owner: sky
--

SELECT pg_catalog.setval('public.leave_types_id_seq', 1, false);


--
-- TOC entry 4063 (class 0 OID 0)
-- Dependencies: 222
-- Name: refresh_tokens_id_seq; Type: SEQUENCE SET; Schema: public; Owner: sky
--

SELECT pg_catalog.setval('public.refresh_tokens_id_seq', 447, true);


--
-- TOC entry 4064 (class 0 OID 0)
-- Dependencies: 226
-- Name: user_approvers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: sky
--

SELECT pg_catalog.setval('public.user_approvers_id_seq', 22, true);


--
-- TOC entry 4065 (class 0 OID 0)
-- Dependencies: 218
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: sky
--

SELECT pg_catalog.setval('public.users_id_seq', 74, true);


--
-- TOC entry 3796 (class 2606 OID 46286)
-- Name: calendar_overrides calendar_overrides_date_key; Type: CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.calendar_overrides
    ADD CONSTRAINT calendar_overrides_date_key UNIQUE (date);


--
-- TOC entry 3798 (class 2606 OID 46284)
-- Name: calendar_overrides calendar_overrides_pkey; Type: CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.calendar_overrides
    ADD CONSTRAINT calendar_overrides_pkey PRIMARY KEY (id);


--
-- TOC entry 3814 (class 2606 OID 46872)
-- Name: comp_balance_transactions comp_balance_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.comp_balance_transactions
    ADD CONSTRAINT comp_balance_transactions_pkey PRIMARY KEY (id);


--
-- TOC entry 3810 (class 2606 OID 46834)
-- Name: comp_work_requests comp_work_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.comp_work_requests
    ADD CONSTRAINT comp_work_requests_pkey PRIMARY KEY (id);


--
-- TOC entry 3744 (class 2606 OID 17095)
-- Name: departments departments_name_key; Type: CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_name_key UNIQUE (name);


--
-- TOC entry 3746 (class 2606 OID 17093)
-- Name: departments departments_pkey; Type: CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_pkey PRIMARY KEY (id);


--
-- TOC entry 3770 (class 2606 OID 32711)
-- Name: email_queue email_queue_idempotency_key_key; Type: CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.email_queue
    ADD CONSTRAINT email_queue_idempotency_key_key UNIQUE (idempotency_key);


--
-- TOC entry 3772 (class 2606 OID 32709)
-- Name: email_queue email_queue_pkey; Type: CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.email_queue
    ADD CONSTRAINT email_queue_pkey PRIMARY KEY (id);


--
-- TOC entry 3812 (class 2606 OID 46846)
-- Name: comp_work_requests excl_comp_work_no_overlap; Type: CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.comp_work_requests
    ADD CONSTRAINT excl_comp_work_no_overlap EXCLUDE USING gist (employee_id WITH =, tsrange(((work_date)::timestamp without time zone + (start_time)::interval), ((work_date)::timestamp without time zone + (end_time)::interval), '[)'::text) WITH &&) WHERE ((status = ANY (ARRAY['pending'::public.comp_work_status, 'approved'::public.comp_work_status])));


--
-- TOC entry 3758 (class 2606 OID 46240)
-- Name: leave_requests excl_leave_no_overlap_active; Type: CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT excl_leave_no_overlap_active EXCLUDE USING gist (user_id WITH =, int4range(start_slot, (end_slot + 1), '[)'::text) WITH &&) WHERE ((status = ANY (ARRAY['pending'::public.leave_status, 'approved'::public.leave_status])));


--
-- TOC entry 3806 (class 2606 OID 46358)
-- Name: leave_balance_transactions leave_balance_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.leave_balance_transactions
    ADD CONSTRAINT leave_balance_transactions_pkey PRIMARY KEY (id);


--
-- TOC entry 3788 (class 2606 OID 46251)
-- Name: leave_categories leave_categories_code_key; Type: CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.leave_categories
    ADD CONSTRAINT leave_categories_code_key UNIQUE (code);


--
-- TOC entry 3790 (class 2606 OID 46249)
-- Name: leave_categories leave_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.leave_categories
    ADD CONSTRAINT leave_categories_pkey PRIMARY KEY (id);


--
-- TOC entry 3808 (class 2606 OID 46392)
-- Name: leave_request_attachments leave_request_attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.leave_request_attachments
    ADD CONSTRAINT leave_request_attachments_pkey PRIMARY KEY (id);


--
-- TOC entry 3804 (class 2606 OID 46335)
-- Name: leave_request_items leave_request_items_pkey; Type: CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.leave_request_items
    ADD CONSTRAINT leave_request_items_pkey PRIMARY KEY (id);


--
-- TOC entry 3784 (class 2606 OID 32759)
-- Name: leave_request_notification_recipients leave_request_notification_recipients_pkey; Type: CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.leave_request_notification_recipients
    ADD CONSTRAINT leave_request_notification_recipients_pkey PRIMARY KEY (id);


--
-- TOC entry 3766 (class 2606 OID 17156)
-- Name: leave_requests leave_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_pkey PRIMARY KEY (id);


--
-- TOC entry 3802 (class 2606 OID 46313)
-- Name: leave_type_conversions leave_type_conversions_pkey; Type: CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.leave_type_conversions
    ADD CONSTRAINT leave_type_conversions_pkey PRIMARY KEY (id);


--
-- TOC entry 3800 (class 2606 OID 46297)
-- Name: leave_type_policies leave_type_policies_pkey; Type: CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.leave_type_policies
    ADD CONSTRAINT leave_type_policies_pkey PRIMARY KEY (id);


--
-- TOC entry 3792 (class 2606 OID 46265)
-- Name: leave_types leave_types_code_key; Type: CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.leave_types
    ADD CONSTRAINT leave_types_code_key UNIQUE (code);


--
-- TOC entry 3794 (class 2606 OID 46263)
-- Name: leave_types leave_types_pkey; Type: CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.leave_types
    ADD CONSTRAINT leave_types_pkey PRIMARY KEY (id);


--
-- TOC entry 3768 (class 2606 OID 17376)
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);


--
-- TOC entry 3786 (class 2606 OID 32761)
-- Name: leave_request_notification_recipients uq_leave_notify_request_user; Type: CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.leave_request_notification_recipients
    ADD CONSTRAINT uq_leave_notify_request_user UNIQUE (request_id, user_id);


--
-- TOC entry 3780 (class 2606 OID 32737)
-- Name: user_approvers user_approvers_pkey; Type: CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.user_approvers
    ADD CONSTRAINT user_approvers_pkey PRIMARY KEY (id);


--
-- TOC entry 3752 (class 2606 OID 17112)
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- TOC entry 3754 (class 2606 OID 17110)
-- Name: users users_employee_id_key; Type: CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_employee_id_key UNIQUE (employee_id);


--
-- TOC entry 3756 (class 2606 OID 17108)
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- TOC entry 3815 (class 1259 OID 46878)
-- Name: idx_comp_tx_employee_time; Type: INDEX; Schema: public; Owner: sky
--

CREATE INDEX idx_comp_tx_employee_time ON public.comp_balance_transactions USING btree (employee_id, created_at);


--
-- TOC entry 3773 (class 1259 OID 32719)
-- Name: idx_email_pick_order; Type: INDEX; Schema: public; Owner: sky
--

CREATE INDEX idx_email_pick_order ON public.email_queue USING btree (status, created_at);


--
-- TOC entry 3774 (class 1259 OID 32718)
-- Name: idx_email_processing_timeout; Type: INDEX; Schema: public; Owner: sky
--

CREATE INDEX idx_email_processing_timeout ON public.email_queue USING btree (status, processing_started_at);


--
-- TOC entry 3775 (class 1259 OID 32720)
-- Name: idx_email_recipient; Type: INDEX; Schema: public; Owner: sky
--

CREATE INDEX idx_email_recipient ON public.email_queue USING btree (recipient_user_id);


--
-- TOC entry 3776 (class 1259 OID 32717)
-- Name: idx_email_status_retry; Type: INDEX; Schema: public; Owner: sky
--

CREATE INDEX idx_email_status_retry ON public.email_queue USING btree (status, next_retry_at);


--
-- TOC entry 3781 (class 1259 OID 32772)
-- Name: idx_leave_notify_request; Type: INDEX; Schema: public; Owner: sky
--

CREATE INDEX idx_leave_notify_request ON public.leave_request_notification_recipients USING btree (request_id);


--
-- TOC entry 3782 (class 1259 OID 32773)
-- Name: idx_leave_notify_user_type; Type: INDEX; Schema: public; Owner: sky
--

CREATE INDEX idx_leave_notify_user_type ON public.leave_request_notification_recipients USING btree (user_id, type);


--
-- TOC entry 3759 (class 1259 OID 17390)
-- Name: idx_leave_requests_approver; Type: INDEX; Schema: public; Owner: sky
--

CREATE INDEX idx_leave_requests_approver ON public.leave_requests USING btree (approver_id);


--
-- TOC entry 3760 (class 1259 OID 32777)
-- Name: idx_leave_requests_approver_status; Type: INDEX; Schema: public; Owner: sky
--

CREATE INDEX idx_leave_requests_approver_status ON public.leave_requests USING btree (approver_id, status);


--
-- TOC entry 3761 (class 1259 OID 17389)
-- Name: idx_leave_requests_dates; Type: INDEX; Schema: public; Owner: sky
--

CREATE INDEX idx_leave_requests_dates ON public.leave_requests USING btree (start_date, end_date);


--
-- TOC entry 3762 (class 1259 OID 17388)
-- Name: idx_leave_requests_status; Type: INDEX; Schema: public; Owner: sky
--

CREATE INDEX idx_leave_requests_status ON public.leave_requests USING btree (status);


--
-- TOC entry 3763 (class 1259 OID 17387)
-- Name: idx_leave_requests_user; Type: INDEX; Schema: public; Owner: sky
--

CREATE INDEX idx_leave_requests_user ON public.leave_requests USING btree (user_id);


--
-- TOC entry 3764 (class 1259 OID 32776)
-- Name: idx_leave_requests_user_status; Type: INDEX; Schema: public; Owner: sky
--

CREATE INDEX idx_leave_requests_user_status ON public.leave_requests USING btree (user_id, status);


--
-- TOC entry 3777 (class 1259 OID 32750)
-- Name: idx_user_approvers_user_active; Type: INDEX; Schema: public; Owner: sky
--

CREATE INDEX idx_user_approvers_user_active ON public.user_approvers USING btree (user_id, active);


--
-- TOC entry 3747 (class 1259 OID 17384)
-- Name: idx_users_department; Type: INDEX; Schema: public; Owner: sky
--

CREATE INDEX idx_users_department ON public.users USING btree (department_id);


--
-- TOC entry 3748 (class 1259 OID 17382)
-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: sky
--

CREATE INDEX idx_users_email ON public.users USING btree (email);


--
-- TOC entry 3749 (class 1259 OID 17385)
-- Name: idx_users_role; Type: INDEX; Schema: public; Owner: sky
--

CREATE INDEX idx_users_role ON public.users USING btree (role);


--
-- TOC entry 3750 (class 1259 OID 17386)
-- Name: idx_users_status; Type: INDEX; Schema: public; Owner: sky
--

CREATE INDEX idx_users_status ON public.users USING btree (status);


--
-- TOC entry 3778 (class 1259 OID 36211)
-- Name: uq_user_approver_active; Type: INDEX; Schema: public; Owner: sky
--

CREATE UNIQUE INDEX uq_user_approver_active ON public.user_approvers USING btree (user_id) WHERE (active = true);


--
-- TOC entry 3841 (class 2620 OID 17408)
-- Name: departments update_departments_updated_at; Type: TRIGGER; Schema: public; Owner: sky
--

CREATE TRIGGER update_departments_updated_at BEFORE UPDATE ON public.departments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 3843 (class 2620 OID 17410)
-- Name: leave_requests update_leave_requests_updated_at; Type: TRIGGER; Schema: public; Owner: sky
--

CREATE TRIGGER update_leave_requests_updated_at BEFORE UPDATE ON public.leave_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 3842 (class 2620 OID 17407)
-- Name: users update_users_updated_at; Type: TRIGGER; Schema: public; Owner: sky
--

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 3840 (class 2606 OID 46873)
-- Name: comp_balance_transactions comp_balance_transactions_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.comp_balance_transactions
    ADD CONSTRAINT comp_balance_transactions_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- TOC entry 3838 (class 2606 OID 46840)
-- Name: comp_work_requests comp_work_requests_approver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.comp_work_requests
    ADD CONSTRAINT comp_work_requests_approver_id_fkey FOREIGN KEY (approver_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- TOC entry 3839 (class 2606 OID 46835)
-- Name: comp_work_requests comp_work_requests_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.comp_work_requests
    ADD CONSTRAINT comp_work_requests_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- TOC entry 3816 (class 2606 OID 17120)
-- Name: departments fk_department_leader; Type: FK CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT fk_department_leader FOREIGN KEY (leader_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 3826 (class 2606 OID 32762)
-- Name: leave_request_notification_recipients fk_leave_notify_request; Type: FK CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.leave_request_notification_recipients
    ADD CONSTRAINT fk_leave_notify_request FOREIGN KEY (request_id) REFERENCES public.leave_requests(id) ON DELETE CASCADE;


--
-- TOC entry 3827 (class 2606 OID 32767)
-- Name: leave_request_notification_recipients fk_leave_notify_user; Type: FK CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.leave_request_notification_recipients
    ADD CONSTRAINT fk_leave_notify_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- TOC entry 3819 (class 2606 OID 46271)
-- Name: leave_requests fk_leave_requests_type; Type: FK CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT fk_leave_requests_type FOREIGN KEY (requested_leave_type_id) REFERENCES public.leave_types(id) ON DELETE RESTRICT;


--
-- TOC entry 3823 (class 2606 OID 32712)
-- Name: email_queue fk_recipient_user; Type: FK CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.email_queue
    ADD CONSTRAINT fk_recipient_user FOREIGN KEY (recipient_user_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- TOC entry 3824 (class 2606 OID 32745)
-- Name: user_approvers fk_user_approvers_approver; Type: FK CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.user_approvers
    ADD CONSTRAINT fk_user_approvers_approver FOREIGN KEY (approver_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- TOC entry 3825 (class 2606 OID 32740)
-- Name: user_approvers fk_user_approvers_user; Type: FK CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.user_approvers
    ADD CONSTRAINT fk_user_approvers_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 3817 (class 2606 OID 36221)
-- Name: users fk_users_department_id; Type: FK CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT fk_users_department_id FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;


--
-- TOC entry 3834 (class 2606 OID 46359)
-- Name: leave_balance_transactions leave_balance_transactions_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.leave_balance_transactions
    ADD CONSTRAINT leave_balance_transactions_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- TOC entry 3835 (class 2606 OID 46364)
-- Name: leave_balance_transactions leave_balance_transactions_leave_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.leave_balance_transactions
    ADD CONSTRAINT leave_balance_transactions_leave_type_id_fkey FOREIGN KEY (leave_type_id) REFERENCES public.leave_types(id) ON DELETE RESTRICT;


--
-- TOC entry 3836 (class 2606 OID 46393)
-- Name: leave_request_attachments leave_request_attachments_leave_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.leave_request_attachments
    ADD CONSTRAINT leave_request_attachments_leave_request_id_fkey FOREIGN KEY (leave_request_id) REFERENCES public.leave_requests(id) ON DELETE CASCADE;


--
-- TOC entry 3837 (class 2606 OID 46398)
-- Name: leave_request_attachments leave_request_attachments_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.leave_request_attachments
    ADD CONSTRAINT leave_request_attachments_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 3832 (class 2606 OID 46336)
-- Name: leave_request_items leave_request_items_leave_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.leave_request_items
    ADD CONSTRAINT leave_request_items_leave_request_id_fkey FOREIGN KEY (leave_request_id) REFERENCES public.leave_requests(id) ON DELETE CASCADE;


--
-- TOC entry 3833 (class 2606 OID 46341)
-- Name: leave_request_items leave_request_items_leave_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.leave_request_items
    ADD CONSTRAINT leave_request_items_leave_type_id_fkey FOREIGN KEY (leave_type_id) REFERENCES public.leave_types(id) ON DELETE RESTRICT;


--
-- TOC entry 3820 (class 2606 OID 32790)
-- Name: leave_requests leave_requests_approver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_approver_id_fkey FOREIGN KEY (approver_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- TOC entry 3821 (class 2606 OID 32795)
-- Name: leave_requests leave_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- TOC entry 3830 (class 2606 OID 46314)
-- Name: leave_type_conversions leave_type_conversions_from_leave_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.leave_type_conversions
    ADD CONSTRAINT leave_type_conversions_from_leave_type_id_fkey FOREIGN KEY (from_leave_type_id) REFERENCES public.leave_types(id) ON DELETE CASCADE;


--
-- TOC entry 3831 (class 2606 OID 46319)
-- Name: leave_type_conversions leave_type_conversions_to_leave_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.leave_type_conversions
    ADD CONSTRAINT leave_type_conversions_to_leave_type_id_fkey FOREIGN KEY (to_leave_type_id) REFERENCES public.leave_types(id) ON DELETE CASCADE;


--
-- TOC entry 3829 (class 2606 OID 46298)
-- Name: leave_type_policies leave_type_policies_leave_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.leave_type_policies
    ADD CONSTRAINT leave_type_policies_leave_type_id_fkey FOREIGN KEY (leave_type_id) REFERENCES public.leave_types(id) ON DELETE CASCADE;


--
-- TOC entry 3828 (class 2606 OID 46266)
-- Name: leave_types leave_types_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.leave_types
    ADD CONSTRAINT leave_types_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.leave_categories(id) ON DELETE SET NULL;


--
-- TOC entry 3822 (class 2606 OID 17377)
-- Name: refresh_tokens refresh_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 3818 (class 2606 OID 17115)
-- Name: users users_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;


--
-- TOC entry 4027 (class 0 OID 0)
-- Dependencies: 6
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: sky
--

REVOKE USAGE ON SCHEMA public FROM PUBLIC;


-- Completed on 2026-02-26 03:51:41 UTC

--
-- PostgreSQL database dump complete
--

\unrestrict nmEegTtWFcHjNdDFh6FLsmkMOcfWUPJKNtePHf7ATNLga5LfNf6KFzY181FIyJh

