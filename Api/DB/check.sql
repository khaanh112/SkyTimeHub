--
-- PostgreSQL database dump
--

\restrict xOeMTPQzmt9fYPvGdVS9pnN6tVGEfCBmwZHOdHODxYiKMmt0dDq03eu9OD3ahlx

-- Dumped from database version 16.11 (Debian 16.11-1.pgdg13+1)
-- Dumped by pg_dump version 16.10

-- Started on 2026-02-26 04:07:44 UTC

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
-- TOC entry 3991 (class 0 OID 0)
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
-- TOC entry 3993 (class 0 OID 0)
-- Dependencies: 2
-- Name: EXTENSION btree_gist; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION btree_gist IS 'support for indexing common datatypes in GiST';


--
-- TOC entry 1079 (class 1247 OID 46848)
-- Name: comp_tx_dir; Type: TYPE; Schema: public; Owner: sky
--

CREATE TYPE public.comp_tx_dir AS ENUM (
    'CREDIT',
    'DEBIT'
);


ALTER TYPE public.comp_tx_dir OWNER TO sky;

--
-- TOC entry 1082 (class 1247 OID 46854)
-- Name: comp_tx_source; Type: TYPE; Schema: public; Owner: sky
--

CREATE TYPE public.comp_tx_source AS ENUM (
    'MAKEUP_APPROVAL',
    'LEAVE_APPROVAL',
    'ADJUSTMENT'
);


ALTER TYPE public.comp_tx_source OWNER TO sky;

--
-- TOC entry 1073 (class 1247 OID 46812)
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
-- TOC entry 1089 (class 1247 OID 45542)
-- Name: leave_session; Type: TYPE; Schema: public; Owner: sky
--

CREATE TYPE public.leave_session AS ENUM (
    'AM',
    'PM'
);


ALTER TYPE public.leave_session OWNER TO sky;

--
-- TOC entry 1110 (class 1247 OID 17022)
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
-- TOC entry 1116 (class 1247 OID 17062)
-- Name: ot_benefit_type; Type: TYPE; Schema: public; Owner: sky
--

CREATE TYPE public.ot_benefit_type AS ENUM (
    'compensatory_leave',
    'overtime_pay'
);


ALTER TYPE public.ot_benefit_type OWNER TO sky;

--
-- TOC entry 1119 (class 1247 OID 17068)
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
-- TOC entry 1113 (class 1247 OID 17034)
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
-- TOC entry 1064 (class 1247 OID 32722)
-- Name: recipient_type; Type: TYPE; Schema: public; Owner: sky
--

CREATE TYPE public.recipient_type AS ENUM (
    'HR',
    'CC',
    'SYSTEM'
);


ALTER TYPE public.recipient_type OWNER TO sky;

--
-- TOC entry 1083 (class 1247 OID 36214)
-- Name: user_gender_enum; Type: TYPE; Schema: public; Owner: sky
--

CREATE TYPE public.user_gender_enum AS ENUM (
    'male',
    'female'
);


ALTER TYPE public.user_gender_enum OWNER TO sky;

--
-- TOC entry 1104 (class 1247 OID 17002)
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
-- TOC entry 1107 (class 1247 OID 17014)
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
-- TOC entry 1086 (class 1247 OID 36228)
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
-- TOC entry 307 (class 1255 OID 46883)
-- Name: set_leave_slots(); Type: FUNCTION; Schema: public; Owner: sky
--

CREATE FUNCTION public.set_leave_slots() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.start_slot :=
    ((NEW.start_date - DATE '2000-01-01') * 2)
    + CASE WHEN NEW.start_session = 'PM' THEN 1 ELSE 0 END;

  NEW.end_slot :=
    ((NEW.end_date - DATE '2000-01-01') * 2)
    + CASE WHEN NEW.end_session = 'PM' THEN 1 ELSE 0 END;

  RETURN NEW;
END;
$$;


ALTER FUNCTION public.set_leave_slots() OWNER TO sky;

--
-- TOC entry 350 (class 1255 OID 17406)
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
-- TOC entry 3994 (class 0 OID 0)
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
-- TOC entry 3995 (class 0 OID 0)
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
-- TOC entry 3996 (class 0 OID 0)
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
-- TOC entry 3997 (class 0 OID 0)
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
-- TOC entry 3998 (class 0 OID 0)
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
-- TOC entry 3999 (class 0 OID 0)
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
-- TOC entry 4000 (class 0 OID 0)
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
-- TOC entry 4001 (class 0 OID 0)
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
-- TOC entry 4002 (class 0 OID 0)
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
-- TOC entry 4003 (class 0 OID 0)
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
    requested_leave_type_id bigint,
    use_comp_balance boolean DEFAULT false NOT NULL,
    comp_used_minutes integer DEFAULT 0 NOT NULL,
    start_slot integer NOT NULL,
    end_slot integer NOT NULL,
    CONSTRAINT ck_leave_comp_used_nonneg CHECK ((comp_used_minutes >= 0)),
    CONSTRAINT ck_leave_comp_used_step CHECK (((comp_used_minutes % 30) = 0)),
    CONSTRAINT ck_leave_duration_step CHECK (((duration_days IS NULL) OR ((duration_days * (2)::numeric) = floor((duration_days * (2)::numeric))))),
    CONSTRAINT ck_leave_request_date_order CHECK ((end_date >= start_date)),
    CONSTRAINT ck_leave_request_session_order CHECK (((end_date > start_date) OR ((start_session = 'AM'::public.leave_session) AND (end_session = ANY (ARRAY['AM'::public.leave_session, 'PM'::public.leave_session]))) OR ((start_session = 'PM'::public.leave_session) AND (end_session = 'PM'::public.leave_session))))
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
-- TOC entry 4004 (class 0 OID 0)
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
-- TOC entry 4005 (class 0 OID 0)
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
-- TOC entry 4006 (class 0 OID 0)
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
-- TOC entry 4007 (class 0 OID 0)
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
-- TOC entry 4008 (class 0 OID 0)
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
-- TOC entry 4009 (class 0 OID 0)
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
-- TOC entry 4010 (class 0 OID 0)
-- Dependencies: 219
-- Name: COLUMN users.department_id; Type: COMMENT; Schema: public; Owner: sky
--

COMMENT ON COLUMN public.users.department_id IS 'Reference to department the employee belongs to';


--
-- TOC entry 4011 (class 0 OID 0)
-- Dependencies: 219
-- Name: COLUMN users."position"; Type: COMMENT; Schema: public; Owner: sky
--

COMMENT ON COLUMN public.users."position" IS 'Job position/title of the employee';


--
-- TOC entry 4012 (class 0 OID 0)
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
-- TOC entry 4013 (class 0 OID 0)
-- Dependencies: 218
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: sky
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- TOC entry 3701 (class 2604 OID 46280)
-- Name: calendar_overrides id; Type: DEFAULT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.calendar_overrides ALTER COLUMN id SET DEFAULT nextval('public.calendar_overrides_id_seq'::regclass);


--
-- TOC entry 3720 (class 2604 OID 46865)
-- Name: comp_balance_transactions id; Type: DEFAULT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.comp_balance_transactions ALTER COLUMN id SET DEFAULT nextval('public.comp_balance_transactions_id_seq'::regclass);


--
-- TOC entry 3717 (class 2604 OID 46825)
-- Name: comp_work_requests id; Type: DEFAULT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.comp_work_requests ALTER COLUMN id SET DEFAULT nextval('public.comp_work_requests_id_seq'::regclass);


--
-- TOC entry 3659 (class 2604 OID 17087)
-- Name: departments id; Type: DEFAULT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.departments ALTER COLUMN id SET DEFAULT nextval('public.departments_id_seq'::regclass);


--
-- TOC entry 3678 (class 2604 OID 32698)
-- Name: email_queue id; Type: DEFAULT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.email_queue ALTER COLUMN id SET DEFAULT nextval('public.email_queue_id_seq'::regclass);


--
-- TOC entry 3712 (class 2604 OID 46350)
-- Name: leave_balance_transactions id; Type: DEFAULT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.leave_balance_transactions ALTER COLUMN id SET DEFAULT nextval('public.leave_balance_transactions_id_seq'::regclass);


--
-- TOC entry 3692 (class 2604 OID 46245)
-- Name: leave_categories id; Type: DEFAULT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.leave_categories ALTER COLUMN id SET DEFAULT nextval('public.leave_categories_id_seq'::regclass);


--
-- TOC entry 3714 (class 2604 OID 46386)
-- Name: leave_request_attachments id; Type: DEFAULT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.leave_request_attachments ALTER COLUMN id SET DEFAULT nextval('public.leave_request_attachments_id_seq'::regclass);


--
-- TOC entry 3710 (class 2604 OID 46328)
-- Name: leave_request_items id; Type: DEFAULT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.leave_request_items ALTER COLUMN id SET DEFAULT nextval('public.leave_request_items_id_seq'::regclass);


--
-- TOC entry 3689 (class 2604 OID 32755)
-- Name: leave_request_notification_recipients id; Type: DEFAULT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.leave_request_notification_recipients ALTER COLUMN id SET DEFAULT nextval('public.leave_request_notification_recipients_id_seq'::regclass);


--
-- TOC entry 3668 (class 2604 OID 17148)
-- Name: leave_requests id; Type: DEFAULT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.leave_requests ALTER COLUMN id SET DEFAULT nextval('public.leave_requests_id_seq'::regclass);


--
-- TOC entry 3707 (class 2604 OID 46307)
-- Name: leave_type_conversions id; Type: DEFAULT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.leave_type_conversions ALTER COLUMN id SET DEFAULT nextval('public.leave_type_conversions_id_seq'::regclass);


--
-- TOC entry 3703 (class 2604 OID 46291)
-- Name: leave_type_policies id; Type: DEFAULT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.leave_type_policies ALTER COLUMN id SET DEFAULT nextval('public.leave_type_policies_id_seq'::regclass);


--
-- TOC entry 3695 (class 2604 OID 46256)
-- Name: leave_types id; Type: DEFAULT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.leave_types ALTER COLUMN id SET DEFAULT nextval('public.leave_types_id_seq'::regclass);


--
-- TOC entry 3675 (class 2604 OID 17372)
-- Name: refresh_tokens id; Type: DEFAULT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.refresh_tokens ALTER COLUMN id SET DEFAULT nextval('public.refresh_tokens_id_seq'::regclass);


--
-- TOC entry 3686 (class 2604 OID 32733)
-- Name: user_approvers id; Type: DEFAULT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.user_approvers ALTER COLUMN id SET DEFAULT nextval('public.user_approvers_id_seq'::regclass);


--
-- TOC entry 3662 (class 2604 OID 17100)
-- Name: users id; Type: DEFAULT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- TOC entry 3794 (class 2606 OID 46286)
-- Name: calendar_overrides calendar_overrides_date_key; Type: CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.calendar_overrides
    ADD CONSTRAINT calendar_overrides_date_key UNIQUE (date);


--
-- TOC entry 3796 (class 2606 OID 46284)
-- Name: calendar_overrides calendar_overrides_pkey; Type: CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.calendar_overrides
    ADD CONSTRAINT calendar_overrides_pkey PRIMARY KEY (id);


--
-- TOC entry 3812 (class 2606 OID 46872)
-- Name: comp_balance_transactions comp_balance_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.comp_balance_transactions
    ADD CONSTRAINT comp_balance_transactions_pkey PRIMARY KEY (id);


--
-- TOC entry 3808 (class 2606 OID 46834)
-- Name: comp_work_requests comp_work_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.comp_work_requests
    ADD CONSTRAINT comp_work_requests_pkey PRIMARY KEY (id);


--
-- TOC entry 3742 (class 2606 OID 17095)
-- Name: departments departments_name_key; Type: CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_name_key UNIQUE (name);


--
-- TOC entry 3744 (class 2606 OID 17093)
-- Name: departments departments_pkey; Type: CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_pkey PRIMARY KEY (id);


--
-- TOC entry 3768 (class 2606 OID 32711)
-- Name: email_queue email_queue_idempotency_key_key; Type: CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.email_queue
    ADD CONSTRAINT email_queue_idempotency_key_key UNIQUE (idempotency_key);


--
-- TOC entry 3770 (class 2606 OID 32709)
-- Name: email_queue email_queue_pkey; Type: CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.email_queue
    ADD CONSTRAINT email_queue_pkey PRIMARY KEY (id);


--
-- TOC entry 3810 (class 2606 OID 46846)
-- Name: comp_work_requests excl_comp_work_no_overlap; Type: CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.comp_work_requests
    ADD CONSTRAINT excl_comp_work_no_overlap EXCLUDE USING gist (employee_id WITH =, tsrange(((work_date)::timestamp without time zone + (start_time)::interval), ((work_date)::timestamp without time zone + (end_time)::interval), '[)'::text) WITH &&) WHERE ((status = ANY (ARRAY['pending'::public.comp_work_status, 'approved'::public.comp_work_status])));


--
-- TOC entry 3756 (class 2606 OID 46886)
-- Name: leave_requests excl_leave_no_overlap_active; Type: CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT excl_leave_no_overlap_active EXCLUDE USING gist (user_id WITH =, int4range(start_slot, (end_slot + 1), '[)'::text) WITH &&) WHERE ((status = ANY (ARRAY['pending'::public.leave_status, 'approved'::public.leave_status])));


--
-- TOC entry 3804 (class 2606 OID 46358)
-- Name: leave_balance_transactions leave_balance_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.leave_balance_transactions
    ADD CONSTRAINT leave_balance_transactions_pkey PRIMARY KEY (id);


--
-- TOC entry 3786 (class 2606 OID 46251)
-- Name: leave_categories leave_categories_code_key; Type: CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.leave_categories
    ADD CONSTRAINT leave_categories_code_key UNIQUE (code);


--
-- TOC entry 3788 (class 2606 OID 46249)
-- Name: leave_categories leave_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.leave_categories
    ADD CONSTRAINT leave_categories_pkey PRIMARY KEY (id);


--
-- TOC entry 3806 (class 2606 OID 46392)
-- Name: leave_request_attachments leave_request_attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.leave_request_attachments
    ADD CONSTRAINT leave_request_attachments_pkey PRIMARY KEY (id);


--
-- TOC entry 3802 (class 2606 OID 46335)
-- Name: leave_request_items leave_request_items_pkey; Type: CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.leave_request_items
    ADD CONSTRAINT leave_request_items_pkey PRIMARY KEY (id);


--
-- TOC entry 3782 (class 2606 OID 32759)
-- Name: leave_request_notification_recipients leave_request_notification_recipients_pkey; Type: CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.leave_request_notification_recipients
    ADD CONSTRAINT leave_request_notification_recipients_pkey PRIMARY KEY (id);


--
-- TOC entry 3764 (class 2606 OID 17156)
-- Name: leave_requests leave_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_pkey PRIMARY KEY (id);


--
-- TOC entry 3800 (class 2606 OID 46313)
-- Name: leave_type_conversions leave_type_conversions_pkey; Type: CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.leave_type_conversions
    ADD CONSTRAINT leave_type_conversions_pkey PRIMARY KEY (id);


--
-- TOC entry 3798 (class 2606 OID 46297)
-- Name: leave_type_policies leave_type_policies_pkey; Type: CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.leave_type_policies
    ADD CONSTRAINT leave_type_policies_pkey PRIMARY KEY (id);


--
-- TOC entry 3790 (class 2606 OID 46265)
-- Name: leave_types leave_types_code_key; Type: CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.leave_types
    ADD CONSTRAINT leave_types_code_key UNIQUE (code);


--
-- TOC entry 3792 (class 2606 OID 46263)
-- Name: leave_types leave_types_pkey; Type: CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.leave_types
    ADD CONSTRAINT leave_types_pkey PRIMARY KEY (id);


--
-- TOC entry 3766 (class 2606 OID 17376)
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);


--
-- TOC entry 3784 (class 2606 OID 32761)
-- Name: leave_request_notification_recipients uq_leave_notify_request_user; Type: CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.leave_request_notification_recipients
    ADD CONSTRAINT uq_leave_notify_request_user UNIQUE (request_id, user_id);


--
-- TOC entry 3778 (class 2606 OID 32737)
-- Name: user_approvers user_approvers_pkey; Type: CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.user_approvers
    ADD CONSTRAINT user_approvers_pkey PRIMARY KEY (id);


--
-- TOC entry 3750 (class 2606 OID 17112)
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- TOC entry 3752 (class 2606 OID 17110)
-- Name: users users_employee_id_key; Type: CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_employee_id_key UNIQUE (employee_id);


--
-- TOC entry 3754 (class 2606 OID 17108)
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- TOC entry 3813 (class 1259 OID 46878)
-- Name: idx_comp_tx_employee_time; Type: INDEX; Schema: public; Owner: sky
--

CREATE INDEX idx_comp_tx_employee_time ON public.comp_balance_transactions USING btree (employee_id, created_at);


--
-- TOC entry 3771 (class 1259 OID 32719)
-- Name: idx_email_pick_order; Type: INDEX; Schema: public; Owner: sky
--

CREATE INDEX idx_email_pick_order ON public.email_queue USING btree (status, created_at);


--
-- TOC entry 3772 (class 1259 OID 32718)
-- Name: idx_email_processing_timeout; Type: INDEX; Schema: public; Owner: sky
--

CREATE INDEX idx_email_processing_timeout ON public.email_queue USING btree (status, processing_started_at);


--
-- TOC entry 3773 (class 1259 OID 32720)
-- Name: idx_email_recipient; Type: INDEX; Schema: public; Owner: sky
--

CREATE INDEX idx_email_recipient ON public.email_queue USING btree (recipient_user_id);


--
-- TOC entry 3774 (class 1259 OID 32717)
-- Name: idx_email_status_retry; Type: INDEX; Schema: public; Owner: sky
--

CREATE INDEX idx_email_status_retry ON public.email_queue USING btree (status, next_retry_at);


--
-- TOC entry 3779 (class 1259 OID 32772)
-- Name: idx_leave_notify_request; Type: INDEX; Schema: public; Owner: sky
--

CREATE INDEX idx_leave_notify_request ON public.leave_request_notification_recipients USING btree (request_id);


--
-- TOC entry 3780 (class 1259 OID 32773)
-- Name: idx_leave_notify_user_type; Type: INDEX; Schema: public; Owner: sky
--

CREATE INDEX idx_leave_notify_user_type ON public.leave_request_notification_recipients USING btree (user_id, type);


--
-- TOC entry 3757 (class 1259 OID 17390)
-- Name: idx_leave_requests_approver; Type: INDEX; Schema: public; Owner: sky
--

CREATE INDEX idx_leave_requests_approver ON public.leave_requests USING btree (approver_id);


--
-- TOC entry 3758 (class 1259 OID 32777)
-- Name: idx_leave_requests_approver_status; Type: INDEX; Schema: public; Owner: sky
--

CREATE INDEX idx_leave_requests_approver_status ON public.leave_requests USING btree (approver_id, status);


--
-- TOC entry 3759 (class 1259 OID 17389)
-- Name: idx_leave_requests_dates; Type: INDEX; Schema: public; Owner: sky
--

CREATE INDEX idx_leave_requests_dates ON public.leave_requests USING btree (start_date, end_date);


--
-- TOC entry 3760 (class 1259 OID 17388)
-- Name: idx_leave_requests_status; Type: INDEX; Schema: public; Owner: sky
--

CREATE INDEX idx_leave_requests_status ON public.leave_requests USING btree (status);


--
-- TOC entry 3761 (class 1259 OID 17387)
-- Name: idx_leave_requests_user; Type: INDEX; Schema: public; Owner: sky
--

CREATE INDEX idx_leave_requests_user ON public.leave_requests USING btree (user_id);


--
-- TOC entry 3762 (class 1259 OID 32776)
-- Name: idx_leave_requests_user_status; Type: INDEX; Schema: public; Owner: sky
--

CREATE INDEX idx_leave_requests_user_status ON public.leave_requests USING btree (user_id, status);


--
-- TOC entry 3775 (class 1259 OID 32750)
-- Name: idx_user_approvers_user_active; Type: INDEX; Schema: public; Owner: sky
--

CREATE INDEX idx_user_approvers_user_active ON public.user_approvers USING btree (user_id, active);


--
-- TOC entry 3745 (class 1259 OID 17384)
-- Name: idx_users_department; Type: INDEX; Schema: public; Owner: sky
--

CREATE INDEX idx_users_department ON public.users USING btree (department_id);


--
-- TOC entry 3746 (class 1259 OID 17382)
-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: sky
--

CREATE INDEX idx_users_email ON public.users USING btree (email);


--
-- TOC entry 3747 (class 1259 OID 17385)
-- Name: idx_users_role; Type: INDEX; Schema: public; Owner: sky
--

CREATE INDEX idx_users_role ON public.users USING btree (role);


--
-- TOC entry 3748 (class 1259 OID 17386)
-- Name: idx_users_status; Type: INDEX; Schema: public; Owner: sky
--

CREATE INDEX idx_users_status ON public.users USING btree (status);


--
-- TOC entry 3776 (class 1259 OID 36211)
-- Name: uq_user_approver_active; Type: INDEX; Schema: public; Owner: sky
--

CREATE UNIQUE INDEX uq_user_approver_active ON public.user_approvers USING btree (user_id) WHERE (active = true);


--
-- TOC entry 3841 (class 2620 OID 46884)
-- Name: leave_requests trg_set_leave_slots; Type: TRIGGER; Schema: public; Owner: sky
--

CREATE TRIGGER trg_set_leave_slots BEFORE INSERT OR UPDATE OF start_date, end_date, start_session, end_session ON public.leave_requests FOR EACH ROW EXECUTE FUNCTION public.set_leave_slots();


--
-- TOC entry 3839 (class 2620 OID 17408)
-- Name: departments update_departments_updated_at; Type: TRIGGER; Schema: public; Owner: sky
--

CREATE TRIGGER update_departments_updated_at BEFORE UPDATE ON public.departments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 3842 (class 2620 OID 17410)
-- Name: leave_requests update_leave_requests_updated_at; Type: TRIGGER; Schema: public; Owner: sky
--

CREATE TRIGGER update_leave_requests_updated_at BEFORE UPDATE ON public.leave_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 3840 (class 2620 OID 17407)
-- Name: users update_users_updated_at; Type: TRIGGER; Schema: public; Owner: sky
--

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 3838 (class 2606 OID 46873)
-- Name: comp_balance_transactions comp_balance_transactions_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.comp_balance_transactions
    ADD CONSTRAINT comp_balance_transactions_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- TOC entry 3836 (class 2606 OID 46840)
-- Name: comp_work_requests comp_work_requests_approver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.comp_work_requests
    ADD CONSTRAINT comp_work_requests_approver_id_fkey FOREIGN KEY (approver_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- TOC entry 3837 (class 2606 OID 46835)
-- Name: comp_work_requests comp_work_requests_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.comp_work_requests
    ADD CONSTRAINT comp_work_requests_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- TOC entry 3814 (class 2606 OID 17120)
-- Name: departments fk_department_leader; Type: FK CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT fk_department_leader FOREIGN KEY (leader_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 3824 (class 2606 OID 32762)
-- Name: leave_request_notification_recipients fk_leave_notify_request; Type: FK CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.leave_request_notification_recipients
    ADD CONSTRAINT fk_leave_notify_request FOREIGN KEY (request_id) REFERENCES public.leave_requests(id) ON DELETE CASCADE;


--
-- TOC entry 3825 (class 2606 OID 32767)
-- Name: leave_request_notification_recipients fk_leave_notify_user; Type: FK CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.leave_request_notification_recipients
    ADD CONSTRAINT fk_leave_notify_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- TOC entry 3817 (class 2606 OID 46271)
-- Name: leave_requests fk_leave_requests_type; Type: FK CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT fk_leave_requests_type FOREIGN KEY (requested_leave_type_id) REFERENCES public.leave_types(id) ON DELETE RESTRICT;


--
-- TOC entry 3821 (class 2606 OID 32712)
-- Name: email_queue fk_recipient_user; Type: FK CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.email_queue
    ADD CONSTRAINT fk_recipient_user FOREIGN KEY (recipient_user_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- TOC entry 3822 (class 2606 OID 32745)
-- Name: user_approvers fk_user_approvers_approver; Type: FK CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.user_approvers
    ADD CONSTRAINT fk_user_approvers_approver FOREIGN KEY (approver_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- TOC entry 3823 (class 2606 OID 32740)
-- Name: user_approvers fk_user_approvers_user; Type: FK CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.user_approvers
    ADD CONSTRAINT fk_user_approvers_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 3815 (class 2606 OID 36221)
-- Name: users fk_users_department_id; Type: FK CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT fk_users_department_id FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;


--
-- TOC entry 3832 (class 2606 OID 46359)
-- Name: leave_balance_transactions leave_balance_transactions_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.leave_balance_transactions
    ADD CONSTRAINT leave_balance_transactions_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- TOC entry 3833 (class 2606 OID 46364)
-- Name: leave_balance_transactions leave_balance_transactions_leave_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.leave_balance_transactions
    ADD CONSTRAINT leave_balance_transactions_leave_type_id_fkey FOREIGN KEY (leave_type_id) REFERENCES public.leave_types(id) ON DELETE RESTRICT;


--
-- TOC entry 3834 (class 2606 OID 46393)
-- Name: leave_request_attachments leave_request_attachments_leave_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.leave_request_attachments
    ADD CONSTRAINT leave_request_attachments_leave_request_id_fkey FOREIGN KEY (leave_request_id) REFERENCES public.leave_requests(id) ON DELETE CASCADE;


--
-- TOC entry 3835 (class 2606 OID 46398)
-- Name: leave_request_attachments leave_request_attachments_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.leave_request_attachments
    ADD CONSTRAINT leave_request_attachments_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 3830 (class 2606 OID 46336)
-- Name: leave_request_items leave_request_items_leave_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.leave_request_items
    ADD CONSTRAINT leave_request_items_leave_request_id_fkey FOREIGN KEY (leave_request_id) REFERENCES public.leave_requests(id) ON DELETE CASCADE;


--
-- TOC entry 3831 (class 2606 OID 46341)
-- Name: leave_request_items leave_request_items_leave_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.leave_request_items
    ADD CONSTRAINT leave_request_items_leave_type_id_fkey FOREIGN KEY (leave_type_id) REFERENCES public.leave_types(id) ON DELETE RESTRICT;


--
-- TOC entry 3818 (class 2606 OID 32790)
-- Name: leave_requests leave_requests_approver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_approver_id_fkey FOREIGN KEY (approver_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- TOC entry 3819 (class 2606 OID 32795)
-- Name: leave_requests leave_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- TOC entry 3828 (class 2606 OID 46314)
-- Name: leave_type_conversions leave_type_conversions_from_leave_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.leave_type_conversions
    ADD CONSTRAINT leave_type_conversions_from_leave_type_id_fkey FOREIGN KEY (from_leave_type_id) REFERENCES public.leave_types(id) ON DELETE CASCADE;


--
-- TOC entry 3829 (class 2606 OID 46319)
-- Name: leave_type_conversions leave_type_conversions_to_leave_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.leave_type_conversions
    ADD CONSTRAINT leave_type_conversions_to_leave_type_id_fkey FOREIGN KEY (to_leave_type_id) REFERENCES public.leave_types(id) ON DELETE CASCADE;


--
-- TOC entry 3827 (class 2606 OID 46298)
-- Name: leave_type_policies leave_type_policies_leave_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.leave_type_policies
    ADD CONSTRAINT leave_type_policies_leave_type_id_fkey FOREIGN KEY (leave_type_id) REFERENCES public.leave_types(id) ON DELETE CASCADE;


--
-- TOC entry 3826 (class 2606 OID 46266)
-- Name: leave_types leave_types_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.leave_types
    ADD CONSTRAINT leave_types_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.leave_categories(id) ON DELETE SET NULL;


--
-- TOC entry 3820 (class 2606 OID 17377)
-- Name: refresh_tokens refresh_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 3816 (class 2606 OID 17115)
-- Name: users users_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;


--
-- TOC entry 3992 (class 0 OID 0)
-- Dependencies: 6
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: sky
--

REVOKE USAGE ON SCHEMA public FROM PUBLIC;


-- Completed on 2026-02-26 04:07:44 UTC

--
-- PostgreSQL database dump complete
--

\unrestrict xOeMTPQzmt9fYPvGdVS9pnN6tVGEfCBmwZHOdHODxYiKMmt0dDq03eu9OD3ahlx

