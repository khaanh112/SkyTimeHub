--
-- PostgreSQL database dump
--

\restrict D0hx2Fh0TtlS29dYUAPf4I4aqzntABwk6mXholAQ9sgkJ2vDjvFmLSffI1TZE5j

-- Dumped from database version 16.11 (Debian 16.11-1.pgdg13+1)
-- Dumped by pg_dump version 16.10

-- Started on 2026-02-25 07:44:54 UTC

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
-- TOC entry 5 (class 2615 OID 16999)
-- Name: public; Type: SCHEMA; Schema: -; Owner: sky
--

-- *not* creating schema, since initdb creates it


ALTER SCHEMA public OWNER TO sky;

--
-- TOC entry 3560 (class 0 OID 0)
-- Dependencies: 5
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: sky
--

COMMENT ON SCHEMA public IS '';


--
-- TOC entry 875 (class 1247 OID 17022)
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
-- TOC entry 881 (class 1247 OID 17062)
-- Name: ot_benefit_type; Type: TYPE; Schema: public; Owner: sky
--

CREATE TYPE public.ot_benefit_type AS ENUM (
    'compensatory_leave',
    'overtime_pay'
);


ALTER TYPE public.ot_benefit_type OWNER TO sky;

--
-- TOC entry 884 (class 1247 OID 17068)
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
-- TOC entry 878 (class 1247 OID 17034)
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
-- TOC entry 854 (class 1247 OID 32722)
-- Name: recipient_type; Type: TYPE; Schema: public; Owner: sky
--

CREATE TYPE public.recipient_type AS ENUM (
    'HR',
    'CC',
    'SYSTEM'
);


ALTER TYPE public.recipient_type OWNER TO sky;

--
-- TOC entry 863 (class 1247 OID 36214)
-- Name: user_gender_enum; Type: TYPE; Schema: public; Owner: sky
--

CREATE TYPE public.user_gender_enum AS ENUM (
    'male',
    'female'
);


ALTER TYPE public.user_gender_enum OWNER TO sky;

--
-- TOC entry 869 (class 1247 OID 17002)
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
-- TOC entry 872 (class 1247 OID 17014)
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
-- TOC entry 866 (class 1247 OID 36228)
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
-- TOC entry 229 (class 1255 OID 17406)
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
-- TOC entry 216 (class 1259 OID 17084)
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
-- TOC entry 215 (class 1259 OID 17083)
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
-- TOC entry 3562 (class 0 OID 0)
-- Dependencies: 215
-- Name: departments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: sky
--

ALTER SEQUENCE public.departments_id_seq OWNED BY public.departments.id;


--
-- TOC entry 224 (class 1259 OID 32695)
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
-- TOC entry 223 (class 1259 OID 32694)
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
-- TOC entry 3563 (class 0 OID 0)
-- Dependencies: 223
-- Name: email_queue_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: sky
--

ALTER SEQUENCE public.email_queue_id_seq OWNED BY public.email_queue.id;


--
-- TOC entry 228 (class 1259 OID 32752)
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
-- TOC entry 227 (class 1259 OID 32751)
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
-- TOC entry 3564 (class 0 OID 0)
-- Dependencies: 227
-- Name: leave_request_notification_recipients_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: sky
--

ALTER SEQUENCE public.leave_request_notification_recipients_id_seq OWNED BY public.leave_request_notification_recipients.id;


--
-- TOC entry 220 (class 1259 OID 17145)
-- Name: leave_requests; Type: TABLE; Schema: public; Owner: sky
--

CREATE TABLE public.leave_requests (
    id integer NOT NULL,
    user_id integer NOT NULL,
    reason text,
    start_date date NOT NULL,
    end_date date NOT NULL,
    start_session character varying(20),
    end_session character varying(20),
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
    work_solution text
);


ALTER TABLE public.leave_requests OWNER TO sky;

--
-- TOC entry 219 (class 1259 OID 17144)
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
-- TOC entry 3565 (class 0 OID 0)
-- Dependencies: 219
-- Name: leave_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: sky
--

ALTER SEQUENCE public.leave_requests_id_seq OWNED BY public.leave_requests.id;


--
-- TOC entry 222 (class 1259 OID 17369)
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
-- TOC entry 221 (class 1259 OID 17368)
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
-- TOC entry 3566 (class 0 OID 0)
-- Dependencies: 221
-- Name: refresh_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: sky
--

ALTER SEQUENCE public.refresh_tokens_id_seq OWNED BY public.refresh_tokens.id;


--
-- TOC entry 226 (class 1259 OID 32730)
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
-- TOC entry 225 (class 1259 OID 32729)
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
-- TOC entry 3567 (class 0 OID 0)
-- Dependencies: 225
-- Name: user_approvers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: sky
--

ALTER SEQUENCE public.user_approvers_id_seq OWNED BY public.user_approvers.id;


--
-- TOC entry 218 (class 1259 OID 17097)
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
-- TOC entry 3568 (class 0 OID 0)
-- Dependencies: 218
-- Name: COLUMN users.department_id; Type: COMMENT; Schema: public; Owner: sky
--

COMMENT ON COLUMN public.users.department_id IS 'Reference to department the employee belongs to';


--
-- TOC entry 3569 (class 0 OID 0)
-- Dependencies: 218
-- Name: COLUMN users."position"; Type: COMMENT; Schema: public; Owner: sky
--

COMMENT ON COLUMN public.users."position" IS 'Job position/title of the employee';


--
-- TOC entry 3570 (class 0 OID 0)
-- Dependencies: 218
-- Name: COLUMN users.official_contract_date; Type: COMMENT; Schema: public; Owner: sky
--

COMMENT ON COLUMN public.users.official_contract_date IS 'Date when official employment contract starts';


--
-- TOC entry 217 (class 1259 OID 17096)
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
-- TOC entry 3571 (class 0 OID 0)
-- Dependencies: 217
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: sky
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- TOC entry 3325 (class 2604 OID 17087)
-- Name: departments id; Type: DEFAULT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.departments ALTER COLUMN id SET DEFAULT nextval('public.departments_id_seq'::regclass);


--
-- TOC entry 3342 (class 2604 OID 32698)
-- Name: email_queue id; Type: DEFAULT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.email_queue ALTER COLUMN id SET DEFAULT nextval('public.email_queue_id_seq'::regclass);


--
-- TOC entry 3353 (class 2604 OID 32755)
-- Name: leave_request_notification_recipients id; Type: DEFAULT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.leave_request_notification_recipients ALTER COLUMN id SET DEFAULT nextval('public.leave_request_notification_recipients_id_seq'::regclass);


--
-- TOC entry 3334 (class 2604 OID 17148)
-- Name: leave_requests id; Type: DEFAULT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.leave_requests ALTER COLUMN id SET DEFAULT nextval('public.leave_requests_id_seq'::regclass);


--
-- TOC entry 3339 (class 2604 OID 17372)
-- Name: refresh_tokens id; Type: DEFAULT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.refresh_tokens ALTER COLUMN id SET DEFAULT nextval('public.refresh_tokens_id_seq'::regclass);


--
-- TOC entry 3350 (class 2604 OID 32733)
-- Name: user_approvers id; Type: DEFAULT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.user_approvers ALTER COLUMN id SET DEFAULT nextval('public.user_approvers_id_seq'::regclass);


--
-- TOC entry 3328 (class 2604 OID 17100)
-- Name: users id; Type: DEFAULT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- TOC entry 3357 (class 2606 OID 17095)
-- Name: departments departments_name_key; Type: CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_name_key UNIQUE (name);


--
-- TOC entry 3359 (class 2606 OID 17093)
-- Name: departments departments_pkey; Type: CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_pkey PRIMARY KEY (id);


--
-- TOC entry 3381 (class 2606 OID 32711)
-- Name: email_queue email_queue_idempotency_key_key; Type: CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.email_queue
    ADD CONSTRAINT email_queue_idempotency_key_key UNIQUE (idempotency_key);


--
-- TOC entry 3383 (class 2606 OID 32709)
-- Name: email_queue email_queue_pkey; Type: CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.email_queue
    ADD CONSTRAINT email_queue_pkey PRIMARY KEY (id);


--
-- TOC entry 3395 (class 2606 OID 32759)
-- Name: leave_request_notification_recipients leave_request_notification_recipients_pkey; Type: CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.leave_request_notification_recipients
    ADD CONSTRAINT leave_request_notification_recipients_pkey PRIMARY KEY (id);


--
-- TOC entry 3377 (class 2606 OID 17156)
-- Name: leave_requests leave_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_pkey PRIMARY KEY (id);


--
-- TOC entry 3379 (class 2606 OID 17376)
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);


--
-- TOC entry 3397 (class 2606 OID 32761)
-- Name: leave_request_notification_recipients uq_leave_notify_request_user; Type: CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.leave_request_notification_recipients
    ADD CONSTRAINT uq_leave_notify_request_user UNIQUE (request_id, user_id);


--
-- TOC entry 3391 (class 2606 OID 32737)
-- Name: user_approvers user_approvers_pkey; Type: CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.user_approvers
    ADD CONSTRAINT user_approvers_pkey PRIMARY KEY (id);


--
-- TOC entry 3365 (class 2606 OID 17112)
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- TOC entry 3367 (class 2606 OID 17110)
-- Name: users users_employee_id_key; Type: CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_employee_id_key UNIQUE (employee_id);


--
-- TOC entry 3369 (class 2606 OID 17108)
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- TOC entry 3384 (class 1259 OID 32719)
-- Name: idx_email_pick_order; Type: INDEX; Schema: public; Owner: sky
--

CREATE INDEX idx_email_pick_order ON public.email_queue USING btree (status, created_at);


--
-- TOC entry 3385 (class 1259 OID 32718)
-- Name: idx_email_processing_timeout; Type: INDEX; Schema: public; Owner: sky
--

CREATE INDEX idx_email_processing_timeout ON public.email_queue USING btree (status, processing_started_at);


--
-- TOC entry 3386 (class 1259 OID 32720)
-- Name: idx_email_recipient; Type: INDEX; Schema: public; Owner: sky
--

CREATE INDEX idx_email_recipient ON public.email_queue USING btree (recipient_user_id);


--
-- TOC entry 3387 (class 1259 OID 32717)
-- Name: idx_email_status_retry; Type: INDEX; Schema: public; Owner: sky
--

CREATE INDEX idx_email_status_retry ON public.email_queue USING btree (status, next_retry_at);


--
-- TOC entry 3392 (class 1259 OID 32772)
-- Name: idx_leave_notify_request; Type: INDEX; Schema: public; Owner: sky
--

CREATE INDEX idx_leave_notify_request ON public.leave_request_notification_recipients USING btree (request_id);


--
-- TOC entry 3393 (class 1259 OID 32773)
-- Name: idx_leave_notify_user_type; Type: INDEX; Schema: public; Owner: sky
--

CREATE INDEX idx_leave_notify_user_type ON public.leave_request_notification_recipients USING btree (user_id, type);


--
-- TOC entry 3370 (class 1259 OID 17390)
-- Name: idx_leave_requests_approver; Type: INDEX; Schema: public; Owner: sky
--

CREATE INDEX idx_leave_requests_approver ON public.leave_requests USING btree (approver_id);


--
-- TOC entry 3371 (class 1259 OID 32777)
-- Name: idx_leave_requests_approver_status; Type: INDEX; Schema: public; Owner: sky
--

CREATE INDEX idx_leave_requests_approver_status ON public.leave_requests USING btree (approver_id, status);


--
-- TOC entry 3372 (class 1259 OID 17389)
-- Name: idx_leave_requests_dates; Type: INDEX; Schema: public; Owner: sky
--

CREATE INDEX idx_leave_requests_dates ON public.leave_requests USING btree (start_date, end_date);


--
-- TOC entry 3373 (class 1259 OID 17388)
-- Name: idx_leave_requests_status; Type: INDEX; Schema: public; Owner: sky
--

CREATE INDEX idx_leave_requests_status ON public.leave_requests USING btree (status);


--
-- TOC entry 3374 (class 1259 OID 17387)
-- Name: idx_leave_requests_user; Type: INDEX; Schema: public; Owner: sky
--

CREATE INDEX idx_leave_requests_user ON public.leave_requests USING btree (user_id);


--
-- TOC entry 3375 (class 1259 OID 32776)
-- Name: idx_leave_requests_user_status; Type: INDEX; Schema: public; Owner: sky
--

CREATE INDEX idx_leave_requests_user_status ON public.leave_requests USING btree (user_id, status);


--
-- TOC entry 3388 (class 1259 OID 32750)
-- Name: idx_user_approvers_user_active; Type: INDEX; Schema: public; Owner: sky
--

CREATE INDEX idx_user_approvers_user_active ON public.user_approvers USING btree (user_id, active);


--
-- TOC entry 3360 (class 1259 OID 17384)
-- Name: idx_users_department; Type: INDEX; Schema: public; Owner: sky
--

CREATE INDEX idx_users_department ON public.users USING btree (department_id);


--
-- TOC entry 3361 (class 1259 OID 17382)
-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: sky
--

CREATE INDEX idx_users_email ON public.users USING btree (email);


--
-- TOC entry 3362 (class 1259 OID 17385)
-- Name: idx_users_role; Type: INDEX; Schema: public; Owner: sky
--

CREATE INDEX idx_users_role ON public.users USING btree (role);


--
-- TOC entry 3363 (class 1259 OID 17386)
-- Name: idx_users_status; Type: INDEX; Schema: public; Owner: sky
--

CREATE INDEX idx_users_status ON public.users USING btree (status);


--
-- TOC entry 3389 (class 1259 OID 36211)
-- Name: uq_user_approver_active; Type: INDEX; Schema: public; Owner: sky
--

CREATE UNIQUE INDEX uq_user_approver_active ON public.user_approvers USING btree (user_id) WHERE (active = true);


--
-- TOC entry 3409 (class 2620 OID 17408)
-- Name: departments update_departments_updated_at; Type: TRIGGER; Schema: public; Owner: sky
--

CREATE TRIGGER update_departments_updated_at BEFORE UPDATE ON public.departments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 3411 (class 2620 OID 17410)
-- Name: leave_requests update_leave_requests_updated_at; Type: TRIGGER; Schema: public; Owner: sky
--

CREATE TRIGGER update_leave_requests_updated_at BEFORE UPDATE ON public.leave_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 3410 (class 2620 OID 17407)
-- Name: users update_users_updated_at; Type: TRIGGER; Schema: public; Owner: sky
--

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 3398 (class 2606 OID 17120)
-- Name: departments fk_department_leader; Type: FK CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT fk_department_leader FOREIGN KEY (leader_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 3407 (class 2606 OID 32762)
-- Name: leave_request_notification_recipients fk_leave_notify_request; Type: FK CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.leave_request_notification_recipients
    ADD CONSTRAINT fk_leave_notify_request FOREIGN KEY (request_id) REFERENCES public.leave_requests(id) ON DELETE CASCADE;


--
-- TOC entry 3408 (class 2606 OID 32767)
-- Name: leave_request_notification_recipients fk_leave_notify_user; Type: FK CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.leave_request_notification_recipients
    ADD CONSTRAINT fk_leave_notify_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- TOC entry 3404 (class 2606 OID 32712)
-- Name: email_queue fk_recipient_user; Type: FK CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.email_queue
    ADD CONSTRAINT fk_recipient_user FOREIGN KEY (recipient_user_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- TOC entry 3405 (class 2606 OID 32745)
-- Name: user_approvers fk_user_approvers_approver; Type: FK CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.user_approvers
    ADD CONSTRAINT fk_user_approvers_approver FOREIGN KEY (approver_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- TOC entry 3406 (class 2606 OID 32740)
-- Name: user_approvers fk_user_approvers_user; Type: FK CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.user_approvers
    ADD CONSTRAINT fk_user_approvers_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 3399 (class 2606 OID 36221)
-- Name: users fk_users_department_id; Type: FK CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT fk_users_department_id FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;


--
-- TOC entry 3401 (class 2606 OID 32790)
-- Name: leave_requests leave_requests_approver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_approver_id_fkey FOREIGN KEY (approver_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- TOC entry 3402 (class 2606 OID 32795)
-- Name: leave_requests leave_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- TOC entry 3403 (class 2606 OID 17377)
-- Name: refresh_tokens refresh_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 3400 (class 2606 OID 17115)
-- Name: users users_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sky
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;


--
-- TOC entry 3561 (class 0 OID 0)
-- Dependencies: 5
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: sky
--

REVOKE USAGE ON SCHEMA public FROM PUBLIC;


-- Completed on 2026-02-25 07:44:54 UTC

--
-- PostgreSQL database dump complete
--

\unrestrict D0hx2Fh0TtlS29dYUAPf4I4aqzntABwk6mXholAQ9sgkJ2vDjvFmLSffI1TZE5j

