# Database Schema

## Table: `active_calls`

| Column Name       | Data Type                | Primary Key | Nullable | Foreign Key To |
| ----------------- | ------------------------ | ----------- | -------- | -------------- |
| id                | uuid                     | Yes         | No       | -              |
| call_sid          | text                     | No          | No       | -              |
| from_number       | text                     | No          | No       | -              |
| to_number         | text                     | No          | No       | -              |
| status            | text                     | No          | No       | -              |
| direction         | text                     | No          | No       | -              |
| lead_id           | uuid                     | No          | Yes      | -              |
| answered_at       | timestamp with time zone | No          | Yes      | -              |
| ended_at          | timestamp with time zone | No          | Yes      | -              |
| created_at        | timestamp with time zone | No          | No       | -              |
| updated_at        | timestamp with time zone | No          | No       | -              |
| call_flow_id      | uuid                     | No          | Yes      | -              |
| webhook_timestamp | timestamp with time zone | No          | Yes      | -              |
| frontend_ack_at   | timestamp with time zone | No          | Yes      | -              |
| entity_type       | USER-DEFINED             | No          | Yes      | -              |
| user_id           | uuid                     | No          | Yes      | users          |

## Table: `activities`

| Column Name        | Data Type                | Primary Key | Nullable | Foreign Key To |
| ------------------ | ------------------------ | ----------- | -------- | -------------- |
| id                 | uuid                     | Yes         | No       | -              |
| entity_id          | uuid                     | No          | No       | -              |
| activity_type      | text                     | No          | No       | -              |
| title              | text                     | No          | Yes      | -              |
| content            | text                     | No          | Yes      | -              |
| created_by         | text                     | No          | Yes      | -              |
| created_at         | timestamp with time zone | No          | No       | -              |
| entity_type        | USER-DEFINED             | No          | Yes      | -              |
| copper_activity_id | text                     | No          | Yes      | -              |
| source_system      | text                     | No          | No       | -              |

## Table: `activity_comments`

| Column Name | Data Type                | Primary Key | Nullable | Foreign Key To |
| ----------- | ------------------------ | ----------- | -------- | -------------- |
| id          | uuid                     | Yes         | No       | -              |
| activity_id | uuid                     | No          | No       | activities     |
| lead_id     | uuid                     | No          | No       | -              |
| content     | text                     | No          | No       | -              |
| created_by  | text                     | No          | Yes      | -              |
| created_at  | timestamp with time zone | No          | No       | -              |
| entity_type | USER-DEFINED             | No          | Yes      | -              |

## Table: `ai_agent_batches`

| Column Name     | Data Type                | Primary Key | Nullable | Foreign Key To   |
| --------------- | ------------------------ | ----------- | -------- | ---------------- |
| id              | uuid                     | Yes         | No       | -                |
| conversation_id | uuid                     | No          | Yes      | ai_conversations |
| user_id         | uuid                     | No          | No       | -                |
| mode            | text                     | No          | No       | -                |
| prompt_summary  | text                     | No          | Yes      | -                |
| total_changes   | integer                  | No          | Yes      | -                |
| status          | text                     | No          | No       | -                |
| created_at      | timestamp with time zone | No          | Yes      | -                |

## Table: `ai_agent_changes`

| Column Name     | Data Type                | Primary Key | Nullable | Foreign Key To   |
| --------------- | ------------------------ | ----------- | -------- | ---------------- |
| id              | uuid                     | Yes         | No       | -                |
| conversation_id | uuid                     | No          | Yes      | ai_conversations |
| user_id         | uuid                     | No          | No       | -                |
| team_member_id  | uuid                     | No          | Yes      | users            |
| mode            | text                     | No          | No       | -                |
| target_table    | text                     | No          | No       | -                |
| target_id       | uuid                     | No          | No       | -                |
| operation       | text                     | No          | No       | -                |
| old_values      | jsonb                    | No          | Yes      | -                |
| new_values      | jsonb                    | No          | No       | -                |
| description     | text                     | No          | No       | -                |
| ai_reasoning    | text                     | No          | Yes      | -                |
| status          | text                     | No          | No       | -                |
| undone_at       | timestamp with time zone | No          | Yes      | -                |
| undone_by       | uuid                     | No          | Yes      | -                |
| batch_id        | uuid                     | No          | Yes      | ai_agent_batches |
| batch_order     | integer                  | No          | Yes      | -                |
| created_at      | timestamp with time zone | No          | Yes      | -                |
| model_used      | text                     | No          | Yes      | -                |

## Table: `ai_conversation_messages`

| Column Name     | Data Type                | Primary Key | Nullable | Foreign Key To   |
| --------------- | ------------------------ | ----------- | -------- | ---------------- |
| id              | uuid                     | Yes         | No       | -                |
| conversation_id | uuid                     | No          | No       | ai_conversations |
| role            | text                     | No          | No       | -                |
| content         | text                     | No          | No       | -                |
| created_at      | timestamp with time zone | No          | No       | -                |
| message_type    | text                     | No          | Yes      | -                |
| metadata        | jsonb                    | No          | Yes      | -                |

## Table: `ai_conversations`

| Column Name | Data Type                | Primary Key | Nullable | Foreign Key To |
| ----------- | ------------------------ | ----------- | -------- | -------------- |
| id          | uuid                     | Yes         | No       | -              |
| user_id     | uuid                     | No          | Yes      | -              |
| title       | text                     | No          | Yes      | -              |
| created_at  | timestamp with time zone | No          | No       | -              |
| updated_at  | timestamp with time zone | No          | No       | -              |
| mode        | text                     | No          | Yes      | -              |

## Table: `appointments`

| Column Name        | Data Type                | Primary Key | Nullable | Foreign Key To |
| ------------------ | ------------------------ | ----------- | -------- | -------------- |
| id                 | uuid                     | Yes         | No       | -              |
| title              | text                     | No          | No       | -              |
| description        | text                     | No          | Yes      | -              |
| start_time         | timestamp with time zone | No          | No       | -              |
| end_time           | timestamp with time zone | No          | Yes      | -              |
| lead_id            | uuid                     | No          | Yes      | -              |
| appointment_type   | text                     | No          | Yes      | -              |
| created_at         | timestamp with time zone | No          | No       | -              |
| updated_at         | timestamp with time zone | No          | No       | -              |
| google_event_id    | text                     | No          | Yes      | -              |
| google_calendar_id | text                     | No          | Yes      | -              |
| synced_at          | timestamp with time zone | No          | Yes      | -              |
| sync_status        | text                     | No          | Yes      | -              |
| user_name          | text                     | No          | Yes      | -              |
| user_id            | uuid                     | No          | Yes      | users          |
| entity_type        | USER-DEFINED             | No          | Yes      | -              |

## Table: `bug_reports`

| Column Name        | Data Type                | Primary Key | Nullable | Foreign Key To |
| ------------------ | ------------------------ | ----------- | -------- | -------------- |
| id                 | uuid                     | Yes         | No       | -              |
| title              | text                     | No          | No       | -              |
| description        | text                     | No          | Yes      | -              |
| priority           | text                     | No          | Yes      | -              |
| status             | text                     | No          | Yes      | -              |
| submitted_by       | text                     | No          | Yes      | -              |
| submitted_by_email | text                     | No          | Yes      | -              |
| screenshot_url     | text                     | No          | Yes      | -              |
| page_url           | text                     | No          | Yes      | -              |
| browser_info       | text                     | No          | Yes      | -              |
| created_at         | timestamp with time zone | No          | No       | -              |
| updated_at         | timestamp with time zone | No          | No       | -              |
| resolved_at        | timestamp with time zone | No          | Yes      | -              |
| assigned_to_id     | uuid                     | No          | Yes      | users          |

## Table: `business_requirements`

| Column Name         | Data Type                | Primary Key | Nullable | Foreign Key To |
| ------------------- | ------------------------ | ----------- | -------- | -------------- |
| id                  | uuid                     | Yes         | No       | -              |
| module_id           | uuid                     | No          | Yes      | modules        |
| requirement_id      | text                     | No          | No       | -              |
| title               | text                     | No          | No       | -              |
| description         | text                     | No          | Yes      | -              |
| acceptance_criteria | text                     | No          | Yes      | -              |
| status              | text                     | No          | No       | -              |
| assigned_to         | text                     | No          | Yes      | -              |
| priority            | text                     | No          | No       | -              |
| created_at          | timestamp with time zone | No          | No       | -              |
| updated_at          | timestamp with time zone | No          | No       | -              |
| portal              | text                     | No          | Yes      | -              |
| is_built            | boolean                  | No          | No       | -              |

## Table: `calendar_connections`

| Column Name   | Data Type                | Primary Key | Nullable | Foreign Key To |
| ------------- | ------------------------ | ----------- | -------- | -------------- |
| id            | uuid                     | Yes         | No       | -              |
| user_id       | uuid                     | No          | No       | -              |
| email         | character varying        | No          | No       | -              |
| access_token  | text                     | No          | No       | -              |
| refresh_token | text                     | No          | No       | -              |
| token_expiry  | timestamp with time zone | No          | No       | -              |
| calendar_id   | text                     | No          | Yes      | -              |
| created_at    | timestamp with time zone | No          | No       | -              |
| updated_at    | timestamp with time zone | No          | No       | -              |
| user_name     | text                     | No          | Yes      | -              |

## Table: `call_events`

| Column Name              | Data Type                | Primary Key | Nullable | Foreign Key To |
| ------------------------ | ------------------------ | ----------- | -------- | -------------- |
| id                       | uuid                     | Yes         | No       | -              |
| call_flow_id             | uuid                     | No          | No       | -              |
| call_sid                 | text                     | No          | No       | -              |
| event_type               | text                     | No          | No       | -              |
| from_number              | text                     | No          | Yes      | -              |
| to_number                | text                     | No          | Yes      | -              |
| lead_id                  | uuid                     | No          | Yes      | -              |
| lead_name                | text                     | No          | Yes      | -              |
| webhook_received         | boolean                  | No          | Yes      | -              |
| db_inserted              | boolean                  | No          | Yes      | -              |
| realtime_sent            | boolean                  | No          | Yes      | -              |
| frontend_received        | boolean                  | No          | Yes      | -              |
| frontend_acknowledged_at | timestamp with time zone | No          | Yes      | -              |
| device_ready             | boolean                  | No          | Yes      | -              |
| socket_connected         | boolean                  | No          | Yes      | -              |
| user_session_active      | boolean                  | No          | Yes      | -              |
| metadata                 | jsonb                    | No          | Yes      | -              |
| created_at               | timestamp with time zone | No          | No       | -              |
| entity_type              | USER-DEFINED             | No          | Yes      | -              |

## Table: `call_rating_notifications`

| Column Name        | Data Type                | Primary Key | Nullable | Foreign Key To |
| ------------------ | ------------------------ | ----------- | -------- | -------------- |
| id                 | uuid                     | Yes         | No       | -              |
| lead_id            | uuid                     | No          | Yes      | -              |
| communication_id   | uuid                     | No          | Yes      | communications |
| call_date          | text                     | No          | No       | -              |
| call_direction     | text                     | No          | No       | -              |
| call_rating        | integer                  | No          | No       | -              |
| rating_reasoning   | text                     | No          | Yes      | -              |
| transcript_preview | text                     | No          | Yes      | -              |
| created_at         | timestamp with time zone | No          | No       | -              |
| read_at            | timestamp with time zone | No          | Yes      | -              |
| entity_type        | USER-DEFINED             | No          | Yes      | -              |

## Table: `communications`

| Column Name        | Data Type                | Primary Key | Nullable | Foreign Key To |
| ------------------ | ------------------------ | ----------- | -------- | -------------- |
| id                 | uuid                     | Yes         | No       | -              |
| lead_id            | uuid                     | No          | Yes      | -              |
| communication_type | text                     | No          | No       | -              |
| direction          | text                     | No          | No       | -              |
| content            | text                     | No          | Yes      | -              |
| phone_number       | text                     | No          | Yes      | -              |
| duration_seconds   | integer                  | No          | Yes      | -              |
| status             | text                     | No          | Yes      | -              |
| created_at         | timestamp with time zone | No          | No       | -              |
| transcript         | text                     | No          | Yes      | -              |
| recording_url      | text                     | No          | Yes      | -              |
| recording_sid      | text                     | No          | Yes      | -              |
| call_sid           | text                     | No          | Yes      | -              |
| user_id            | uuid                     | No          | Yes      | users          |
| entity_type        | USER-DEFINED             | No          | Yes      | -              |

## Table: `companies`

| Column Name       | Data Type                | Primary Key | Nullable | Foreign Key To |
| ----------------- | ------------------------ | ----------- | -------- | -------------- |
| id                | uuid                     | Yes         | No       | -              |
| company_name      | text                     | No          | No       | -              |
| website           | text                     | No          | Yes      | -              |
| work_website      | text                     | No          | Yes      | -              |
| contact_type      | text                     | No          | Yes      | -              |
| source            | text                     | No          | Yes      | -              |
| assigned_to       | uuid                     | No          | Yes      | users          |
| notes             | text                     | No          | Yes      | -              |
| description       | text                     | No          | Yes      | -              |
| about             | text                     | No          | Yes      | -              |
| tags              | ARRAY                    | No          | Yes      | -              |
| last_activity_at  | timestamp with time zone | No          | Yes      | -              |
| created_at        | timestamp with time zone | No          | No       | -              |
| updated_at        | timestamp with time zone | No          | No       | -              |
| copper_company_id | text                     | No          | Yes      | -              |
| source_system     | text                     | No          | No       | -              |

## Table: `company_people`

| Column Name | Data Type                | Primary Key | Nullable | Foreign Key To |
| ----------- | ------------------------ | ----------- | -------- | -------------- |
| id          | uuid                     | Yes         | No       | -              |
| company_id  | uuid                     | No          | No       | companies      |
| person_id   | uuid                     | No          | No       | people         |
| role        | text                     | No          | Yes      | -              |
| created_at  | timestamp with time zone | No          | No       | -              |

## Table: `contracts`

| Column Name    | Data Type                | Primary Key | Nullable | Foreign Key To |
| -------------- | ------------------------ | ----------- | -------- | -------------- |
| id             | uuid                     | Yes         | No       | -              |
| client_id      | uuid                     | No          | No       | -              |
| title          | text                     | No          | No       | -              |
| content        | text                     | No          | No       | -              |
| status         | USER-DEFINED             | No          | No       | -              |
| sent_at        | timestamp with time zone | No          | Yes      | -              |
| viewed_at      | timestamp with time zone | No          | Yes      | -              |
| signed_at      | timestamp with time zone | No          | Yes      | -              |
| signature_data | text                     | No          | Yes      | -              |
| signer_name    | text                     | No          | Yes      | -              |
| signer_ip      | text                     | No          | Yes      | -              |
| expires_at     | timestamp with time zone | No          | Yes      | -              |
| created_at     | timestamp with time zone | No          | No       | -              |
| updated_at     | timestamp with time zone | No          | No       | -              |

## Table: `conversations`

| Column Name     | Data Type                | Primary Key | Nullable | Foreign Key To |
| --------------- | ------------------------ | ----------- | -------- | -------------- |
| id              | uuid                     | Yes         | No       | -              |
| client_id       | uuid                     | No          | No       | -              |
| subject         | text                     | No          | Yes      | -              |
| last_message_at | timestamp with time zone | No          | Yes      | -              |
| created_at      | timestamp with time zone | No          | No       | -              |

## Table: `dashboard_deals`

| Column Name      | Data Type                | Primary Key | Nullable | Foreign Key To |
| ---------------- | ------------------------ | ----------- | -------- | -------------- |
| id               | uuid                     | Yes         | No       | -              |
| stage            | text                     | No          | No       | -              |
| deal_name        | text                     | No          | Yes      | -              |
| requested_amount | numeric                  | No          | No       | -              |
| weighted_fees    | numeric                  | No          | No       | -              |
| days_in_stage    | integer                  | No          | No       | -              |
| created_at       | timestamp with time zone | No          | No       | -              |
| closed_at        | timestamp with time zone | No          | Yes      | -              |
| user_id          | uuid                     | No          | Yes      | users          |

## Table: `dashboard_referral_sources`

| Column Name           | Data Type                | Primary Key | Nullable | Foreign Key To |
| --------------------- | ------------------------ | ----------- | -------- | -------------- |
| id                    | uuid                     | Yes         | No       | -              |
| name                  | text                     | No          | No       | -              |
| total_revenue         | numeric                  | No          | No       | -              |
| status                | text                     | No          | No       | -              |
| last_contact_days_ago | integer                  | No          | No       | -              |
| created_at            | timestamp with time zone | No          | No       | -              |

## Table: `dashboard_weekly_scorecard`

| Column Name   | Data Type                | Primary Key | Nullable | Foreign Key To |
| ------------- | ------------------------ | ----------- | -------- | -------------- |
| id            | uuid                     | Yes         | No       | -              |
| metric_label  | text                     | No          | No       | -              |
| metric_value  | text                     | No          | No       | -              |
| display_order | integer                  | No          | No       | -              |
| color_class   | text                     | No          | Yes      | -              |
| created_at    | timestamp with time zone | No          | No       | -              |

## Table: `deal_lender_programs`

| Column Name | Data Type                | Primary Key | Nullable | Foreign Key To  |
| ----------- | ------------------------ | ----------- | -------- | --------------- |
| id          | uuid                     | Yes         | No       | -               |
| entity_id   | uuid                     | No          | No       | -               |
| program_id  | uuid                     | No          | No       | lender_programs |
| notes       | text                     | No          | Yes      | -               |
| status      | text                     | No          | Yes      | -               |
| created_at  | timestamp with time zone | No          | No       | -               |
| updated_at  | timestamp with time zone | No          | No       | -               |
| entity_type | USER-DEFINED             | No          | Yes      | -               |

## Table: `deal_milestones`

| Column Name    | Data Type                | Primary Key | Nullable | Foreign Key To |
| -------------- | ------------------------ | ----------- | -------- | -------------- |
| id             | uuid                     | Yes         | No       | -              |
| lead_id        | uuid                     | No          | No       | -              |
| milestone_name | text                     | No          | No       | -              |
| completed      | boolean                  | No          | No       | -              |
| completed_by   | text                     | No          | Yes      | -              |
| completed_at   | timestamp with time zone | No          | Yes      | -              |
| notes          | text                     | No          | Yes      | -              |
| position       | integer                  | No          | No       | -              |
| created_at     | timestamp with time zone | No          | No       | -              |
| updated_at     | timestamp with time zone | No          | No       | -              |
| entity_type    | USER-DEFINED             | No          | Yes      | -              |

## Table: `deal_responses`

| Column Name                  | Data Type                | Primary Key | Nullable | Foreign Key To |
| ---------------------------- | ------------------------ | ----------- | -------- | -------------- |
| id                           | uuid                     | Yes         | No       | -              |
| entity_id                    | uuid                     | No          | No       | -              |
| business_type                | text                     | No          | Yes      | -              |
| funding_amount               | text                     | No          | Yes      | -              |
| funding_timeline             | text                     | No          | Yes      | -              |
| annual_revenue               | text                     | No          | Yes      | -              |
| funding_purpose              | text                     | No          | Yes      | -              |
| submitted_at                 | timestamp with time zone | No          | No       | -              |
| created_at                   | timestamp with time zone | No          | No       | -              |
| first_name                   | text                     | No          | Yes      | -              |
| last_name                    | text                     | No          | Yes      | -              |
| email                        | text                     | No          | Yes      | -              |
| phone                        | text                     | No          | Yes      | -              |
| newsletter_signup            | boolean                  | No          | Yes      | -              |
| contact_method               | text                     | No          | Yes      | -              |
| country                      | text                     | No          | Yes      | -              |
| address_line_1               | text                     | No          | Yes      | -              |
| address_line_2               | text                     | No          | Yes      | -              |
| city                         | text                     | No          | Yes      | -              |
| state                        | text                     | No          | Yes      | -              |
| zip_code                     | text                     | No          | Yes      | -              |
| principal_name               | text                     | No          | Yes      | -              |
| co_borrowers                 | text                     | No          | Yes      | -              |
| guarantors                   | text                     | No          | Yes      | -              |
| loan_amount                  | numeric                  | No          | Yes      | -              |
| purpose_of_loan              | text                     | No          | Yes      | -              |
| collateral_value             | numeric                  | No          | Yes      | -              |
| collateral_description       | text                     | No          | Yes      | -              |
| loan_type                    | text                     | No          | Yes      | -              |
| loan_type_other              | text                     | No          | Yes      | -              |
| cash_out                     | text                     | No          | Yes      | -              |
| cash_out_amount              | numeric                  | No          | Yes      | -              |
| current_lender               | text                     | No          | Yes      | -              |
| current_loan_balance         | numeric                  | No          | Yes      | -              |
| current_loan_rate            | text                     | No          | Yes      | -              |
| current_loan_maturity_date   | date                     | No          | Yes      | -              |
| current_loan_in_default      | text                     | No          | Yes      | -              |
| property_owner_occupied      | text                     | No          | Yes      | -              |
| year_acquired                | text                     | No          | Yes      | -              |
| purchase_price               | numeric                  | No          | Yes      | -              |
| current_estimated_value      | numeric                  | No          | Yes      | -              |
| square_footage               | text                     | No          | Yes      | -              |
| number_of_units              | text                     | No          | Yes      | -              |
| borrower_occupation          | text                     | No          | Yes      | -              |
| borrower_year_started        | text                     | No          | Yes      | -              |
| borrower_current_employer    | text                     | No          | Yes      | -              |
| co_borrower_occupation       | text                     | No          | Yes      | -              |
| co_borrower_year_started     | text                     | No          | Yes      | -              |
| co_borrower_current_employer | text                     | No          | Yes      | -              |
| self_employed_business_type  | text                     | No          | Yes      | -              |
| year_business_founded        | text                     | No          | Yes      | -              |
| business_description         | text                     | No          | Yes      | -              |
| desired_interest_rate        | text                     | No          | Yes      | -              |
| desired_term                 | text                     | No          | Yes      | -              |
| desired_amortization         | text                     | No          | Yes      | -              |
| borrower_bankruptcy          | text                     | No          | Yes      | -              |
| co_borrower_bankruptcy       | text                     | No          | Yes      | -              |
| borrower_credit_score        | text                     | No          | Yes      | -              |
| co_borrower_credit_score     | text                     | No          | Yes      | -              |
| additional_information       | text                     | No          | Yes      | -              |
| how_did_you_hear             | text                     | No          | Yes      | -              |
| referred_by                  | text                     | No          | Yes      | -              |
| entity_type                  | USER-DEFINED             | No          | Yes      | -              |

## Table: `deal_waiting_on`

| Column Name | Data Type                | Primary Key | Nullable | Foreign Key To |
| ----------- | ------------------------ | ----------- | -------- | -------------- |
| id          | uuid                     | Yes         | No       | -              |
| lead_id     | uuid                     | No          | No       | -              |
| owner       | text                     | No          | No       | -              |
| description | text                     | No          | Yes      | -              |
| due_date    | timestamp with time zone | No          | Yes      | -              |
| resolved_at | timestamp with time zone | No          | Yes      | -              |
| resolved_by | text                     | No          | Yes      | -              |
| created_at  | timestamp with time zone | No          | No       | -              |
| updated_at  | timestamp with time zone | No          | No       | -              |
| entity_type | USER-DEFINED             | No          | Yes      | -              |

## Table: `dropbox_connections`

| Column Name   | Data Type                | Primary Key | Nullable | Foreign Key To |
| ------------- | ------------------------ | ----------- | -------- | -------------- |
| id            | uuid                     | Yes         | No       | -              |
| user_id       | uuid                     | No          | No       | -              |
| connected_by  | text                     | No          | Yes      | -              |
| email         | text                     | No          | No       | -              |
| access_token  | text                     | No          | No       | -              |
| refresh_token | text                     | No          | No       | -              |
| token_expiry  | timestamp with time zone | No          | No       | -              |
| account_id    | text                     | No          | Yes      | -              |
| cursor        | text                     | No          | Yes      | -              |
| last_sync_at  | timestamp with time zone | No          | Yes      | -              |
| created_at    | timestamp with time zone | No          | Yes      | -              |
| updated_at    | timestamp with time zone | No          | Yes      | -              |

## Table: `dropbox_files`

| Column Name          | Data Type                | Primary Key | Nullable | Foreign Key To |
| -------------------- | ------------------------ | ----------- | -------- | -------------- |
| id                   | uuid                     | Yes         | No       | -              |
| dropbox_id           | text                     | No          | No       | -              |
| dropbox_path         | text                     | No          | No       | -              |
| dropbox_path_display | text                     | No          | No       | -              |
| dropbox_rev          | text                     | No          | Yes      | -              |
| name                 | text                     | No          | No       | -              |
| is_folder            | boolean                  | No          | No       | -              |
| size                 | bigint                   | No          | Yes      | -              |
| mime_type            | text                     | No          | Yes      | -              |
| modified_at          | timestamp with time zone | No          | Yes      | -              |
| content_hash         | text                     | No          | Yes      | -              |
| extracted_text       | text                     | No          | Yes      | -              |
| extraction_status    | text                     | No          | Yes      | -              |
| extraction_error     | text                     | No          | Yes      | -              |
| extracted_at         | timestamp with time zone | No          | Yes      | -              |
| lead_id              | uuid                     | No          | Yes      | potential      |
| synced_at            | timestamp with time zone | No          | Yes      | -              |
| created_at           | timestamp with time zone | No          | Yes      | -              |
| updated_at           | timestamp with time zone | No          | Yes      | -              |
| entity_type          | USER-DEFINED             | No          | Yes      | -              |

## Table: `email_templates`

| Column Name | Data Type                | Primary Key | Nullable | Foreign Key To |
| ----------- | ------------------------ | ----------- | -------- | -------------- |
| id          | uuid                     | Yes         | No       | -              |
| name        | text                     | No          | No       | -              |
| subject     | text                     | No          | No       | -              |
| body        | text                     | No          | No       | -              |
| category    | text                     | No          | Yes      | -              |
| created_at  | timestamp with time zone | No          | No       | -              |
| updated_at  | timestamp with time zone | No          | No       | -              |
| user_id     | uuid                     | No          | Yes      | users          |

## Table: `email_threads`

| Column Name        | Data Type                | Primary Key | Nullable | Foreign Key To |
| ------------------ | ------------------------ | ----------- | -------- | -------------- |
| id                 | uuid                     | Yes         | No       | -              |
| thread_id          | text                     | No          | No       | -              |
| lead_id            | uuid                     | No          | Yes      | potential      |
| subject            | text                     | No          | Yes      | -              |
| last_message_date  | timestamp with time zone | No          | Yes      | -              |
| next_action        | text                     | No          | Yes      | -              |
| waiting_on         | text                     | No          | Yes      | -              |
| is_triaged         | boolean                  | No          | Yes      | -              |
| assigned_to        | uuid                     | No          | Yes      | users          |
| sla_breached       | boolean                  | No          | Yes      | -              |
| last_outbound_date | timestamp with time zone | No          | Yes      | -              |
| created_at         | timestamp with time zone | No          | Yes      | -              |
| updated_at         | timestamp with time zone | No          | Yes      | -              |
| entity_type        | USER-DEFINED             | No          | Yes      | -              |

## Table: `entity_addresses`

| Column Name    | Data Type                | Primary Key | Nullable | Foreign Key To |
| -------------- | ------------------------ | ----------- | -------- | -------------- |
| id             | uuid                     | Yes         | No       | -              |
| entity_id      | uuid                     | No          | No       | -              |
| address_type   | text                     | No          | Yes      | -              |
| address_line_1 | text                     | No          | Yes      | -              |
| address_line_2 | text                     | No          | Yes      | -              |
| city           | text                     | No          | Yes      | -              |
| state          | text                     | No          | Yes      | -              |
| zip_code       | text                     | No          | Yes      | -              |
| country        | text                     | No          | Yes      | -              |
| is_primary     | boolean                  | No          | Yes      | -              |
| created_at     | timestamp with time zone | No          | No       | -              |
| entity_type    | USER-DEFINED             | No          | Yes      | -              |

## Table: `entity_checklist_items`

| Column Name  | Data Type                | Primary Key | Nullable | Foreign Key To    |
| ------------ | ------------------------ | ----------- | -------- | ----------------- |
| id           | uuid                     | Yes         | No       | -                 |
| checklist_id | uuid                     | No          | No       | entity_checklists |
| label        | text                     | No          | No       | -                 |
| is_completed | boolean                  | No          | No       | -                 |
| completed_at | timestamp with time zone | No          | Yes      | -                 |
| completed_by | uuid                     | No          | Yes      | users             |
| sort_order   | integer                  | No          | No       | -                 |
| created_at   | timestamp with time zone | No          | No       | -                 |

## Table: `entity_checklists`

| Column Name | Data Type                | Primary Key | Nullable | Foreign Key To |
| ----------- | ------------------------ | ----------- | -------- | -------------- |
| id          | uuid                     | Yes         | No       | -              |
| entity_id   | uuid                     | No          | No       | -              |
| entity_type | USER-DEFINED             | No          | No       | -              |
| title       | text                     | No          | No       | -              |
| description | text                     | No          | Yes      | -              |
| created_by  | uuid                     | No          | Yes      | users          |
| created_at  | timestamp with time zone | No          | No       | -              |
| updated_at  | timestamp with time zone | No          | No       | -              |

## Table: `entity_contacts`

| Column Name | Data Type                | Primary Key | Nullable | Foreign Key To |
| ----------- | ------------------------ | ----------- | -------- | -------------- |
| id          | uuid                     | Yes         | No       | -              |
| entity_id   | uuid                     | No          | No       | -              |
| name        | text                     | No          | No       | -              |
| title       | text                     | No          | Yes      | -              |
| email       | text                     | No          | Yes      | -              |
| phone       | text                     | No          | Yes      | -              |
| is_primary  | boolean                  | No          | Yes      | -              |
| notes       | text                     | No          | Yes      | -              |
| created_at  | timestamp with time zone | No          | No       | -              |
| updated_at  | timestamp with time zone | No          | No       | -              |
| entity_type | USER-DEFINED             | No          | Yes      | -              |

## Table: `entity_emails`

| Column Name | Data Type                | Primary Key | Nullable | Foreign Key To |
| ----------- | ------------------------ | ----------- | -------- | -------------- |
| id          | uuid                     | Yes         | No       | -              |
| entity_id   | uuid                     | No          | No       | -              |
| email       | text                     | No          | No       | -              |
| email_type  | text                     | No          | Yes      | -              |
| is_primary  | boolean                  | No          | Yes      | -              |
| created_at  | timestamp with time zone | No          | No       | -              |
| entity_type | USER-DEFINED             | No          | Yes      | -              |

## Table: `entity_files`

| Column Name    | Data Type                | Primary Key | Nullable | Foreign Key To |
| -------------- | ------------------------ | ----------- | -------- | -------------- |
| id             | uuid                     | Yes         | No       | -              |
| entity_id      | uuid                     | No          | No       | -              |
| file_name      | text                     | No          | No       | -              |
| file_url       | text                     | No          | No       | -              |
| file_type      | text                     | No          | Yes      | -              |
| file_size      | bigint                   | No          | Yes      | -              |
| uploaded_by    | text                     | No          | Yes      | -              |
| created_at     | timestamp with time zone | No          | No       | -              |
| entity_type    | USER-DEFINED             | No          | Yes      | -              |
| copper_file_id | text                     | No          | Yes      | -              |
| source_system  | text                     | No          | No       | -              |

## Table: `entity_followers`

| Column Name | Data Type                | Primary Key | Nullable | Foreign Key To |
| ----------- | ------------------------ | ----------- | -------- | -------------- |
| id          | uuid                     | Yes         | No       | -              |
| entity_id   | uuid                     | No          | No       | -              |
| user_id     | uuid                     | No          | No       | users          |
| created_at  | timestamp with time zone | No          | Yes      | -              |
| entity_type | USER-DEFINED             | No          | Yes      | -              |

## Table: `entity_phones`

| Column Name  | Data Type                | Primary Key | Nullable | Foreign Key To |
| ------------ | ------------------------ | ----------- | -------- | -------------- |
| id           | uuid                     | Yes         | No       | -              |
| entity_id    | uuid                     | No          | No       | -              |
| phone_number | text                     | No          | No       | -              |
| phone_type   | text                     | No          | Yes      | -              |
| is_primary   | boolean                  | No          | Yes      | -              |
| created_at   | timestamp with time zone | No          | No       | -              |
| entity_type  | USER-DEFINED             | No          | Yes      | -              |

## Table: `entity_projects`

| Column Name        | Data Type                | Primary Key | Nullable | Foreign Key To |
| ------------------ | ------------------------ | ----------- | -------- | -------------- |
| id                 | uuid                     | Yes         | No       | -              |
| entity_id          | uuid                     | No          | No       | -              |
| name               | text                     | No          | No       | -              |
| status             | text                     | No          | Yes      | -              |
| project_stage      | text                     | No          | Yes      | -              |
| priority           | text                     | No          | Yes      | -              |
| owner              | uuid                     | No          | Yes      | users          |
| due_date           | timestamp with time zone | No          | Yes      | -              |
| description        | text                     | No          | Yes      | -              |
| visibility         | text                     | No          | Yes      | -              |
| tags               | ARRAY                    | No          | Yes      | -              |
| clx_file_name      | text                     | No          | Yes      | -              |
| bank_relationships | text                     | No          | Yes      | -              |
| waiting_on         | text                     | No          | Yes      | -              |
| related_to         | text                     | No          | Yes      | -              |
| created_by         | text                     | No          | Yes      | -              |
| created_at         | timestamp with time zone | No          | No       | -              |
| updated_at         | timestamp with time zone | No          | No       | -              |
| entity_type        | USER-DEFINED             | No          | Yes      | -              |

## Table: `feed_reactions`

| Column Name | Data Type                | Primary Key | Nullable | Foreign Key To |
| ----------- | ------------------------ | ----------- | -------- | -------------- |
| id          | uuid                     | Yes         | No       | -              |
| activity_id | text                     | No          | No       | -              |
| emoji       | text                     | No          | No       | -              |
| user_id     | uuid                     | No          | No       | -              |
| user_name   | text                     | No          | Yes      | -              |
| created_at  | timestamp with time zone | No          | No       | -              |

## Table: `gmail_connections`

| Column Name   | Data Type                | Primary Key | Nullable | Foreign Key To |
| ------------- | ------------------------ | ----------- | -------- | -------------- |
| id            | uuid                     | Yes         | No       | -              |
| user_id       | uuid                     | No          | No       | -              |
| email         | character varying        | No          | No       | -              |
| access_token  | text                     | No          | No       | -              |
| refresh_token | text                     | No          | No       | -              |
| token_expiry  | timestamp with time zone | No          | No       | -              |
| created_at    | timestamp with time zone | No          | No       | -              |
| updated_at    | timestamp with time zone | No          | No       | -              |

## Table: `hidden_email_threads`

| Column Name | Data Type                | Primary Key | Nullable | Foreign Key To |
| ----------- | ------------------------ | ----------- | -------- | -------------- |
| id          | uuid                     | Yes         | No       | -              |
| thread_id   | text                     | No          | No       | -              |
| hidden_by   | uuid                     | No          | No       | users          |
| created_at  | timestamp with time zone | No          | Yes      | -              |

## Table: `invoices`

| Column Name       | Data Type                | Primary Key | Nullable | Foreign Key To |
| ----------------- | ------------------------ | ----------- | -------- | -------------- |
| id                | uuid                     | Yes         | No       | -              |
| client_id         | uuid                     | No          | No       | -              |
| invoice_number    | text                     | No          | No       | -              |
| description       | text                     | No          | Yes      | -              |
| amount            | numeric                  | No          | No       | -              |
| due_date          | date                     | No          | No       | -              |
| status            | USER-DEFINED             | No          | No       | -              |
| sent_at           | timestamp with time zone | No          | Yes      | -              |
| viewed_at         | timestamp with time zone | No          | Yes      | -              |
| paid_at           | timestamp with time zone | No          | Yes      | -              |
| payment_method    | text                     | No          | Yes      | -              |
| payment_reference | text                     | No          | Yes      | -              |
| notes             | text                     | No          | Yes      | -              |
| created_at        | timestamp with time zone | No          | No       | -              |
| updated_at        | timestamp with time zone | No          | No       | -              |

## Table: `lender_management`

| Column Name              | Data Type                | Primary Key | Nullable | Foreign Key To  |
| ------------------------ | ------------------------ | ----------- | -------- | --------------- |
| id                       | uuid                     | Yes         | No       | -               |
| name                     | text                     | No          | No       | -               |
| email                    | text                     | No          | Yes      | -               |
| phone                    | text                     | No          | Yes      | -               |
| company_name             | text                     | No          | Yes      | -               |
| status                   | USER-DEFINED             | No          | No       | -               |
| stage_id                 | uuid                     | No          | Yes      | pipeline_stages |
| origin_pipeline_id       | uuid                     | No          | Yes      | potential       |
| source                   | text                     | No          | Yes      | -               |
| notes                    | text                     | No          | Yes      | -               |
| assigned_to              | uuid                     | No          | Yes      | users           |
| qualified_at             | timestamp with time zone | No          | Yes      | -               |
| converted_at             | timestamp with time zone | No          | Yes      | -               |
| converted_to_client_id   | uuid                     | No          | Yes      | -               |
| known_as                 | text                     | No          | Yes      | -               |
| title                    | text                     | No          | Yes      | -               |
| contact_type             | text                     | No          | Yes      | -               |
| tags                     | ARRAY                    | No          | Yes      | -               |
| about                    | text                     | No          | Yes      | -               |
| next_action              | text                     | No          | Yes      | -               |
| waiting_on               | text                     | No          | Yes      | -               |
| sla_threshold_days       | integer                  | No          | Yes      | -               |
| last_activity_at         | timestamp with time zone | No          | Yes      | -               |
| initial_nudge_created_at | timestamp with time zone | No          | Yes      | -               |
| cohort_year              | integer                  | No          | Yes      | -               |
| flagged_for_weekly       | boolean                  | No          | No       | -               |
| uw_number                | text                     | No          | Yes      | -               |
| client_other_lenders     | boolean                  | No          | No       | -               |
| deal_value               | numeric                  | No          | Yes      | -               |
| history                  | text                     | No          | Yes      | -               |
| bank_relationships       | text                     | No          | Yes      | -               |
| opportunity_name         | text                     | No          | Yes      | -               |
| clx_file_name            | text                     | No          | Yes      | -               |
| description              | text                     | No          | Yes      | -               |
| close_date               | timestamp with time zone | No          | Yes      | -               |
| loss_reason              | text                     | No          | Yes      | -               |
| priority                 | USER-DEFINED             | No          | Yes      | -               |
| win_percentage           | integer                  | No          | Yes      | -               |
| visibility               | text                     | No          | Yes      | -               |
| last_contacted           | timestamp with time zone | No          | Yes      | -               |
| target_closing_date      | date                     | No          | Yes      | -               |
| clx_agreement            | boolean                  | No          | Yes      | -               |
| loan_category            | text                     | No          | Yes      | -               |
| wu_date                  | date                     | No          | Yes      | -               |
| loan_stage               | text                     | No          | Yes      | -               |
| won                      | boolean                  | No          | Yes      | -               |
| lender_type              | text                     | No          | Yes      | -               |
| lender_name              | text                     | No          | Yes      | -               |
| fee_percent              | numeric                  | No          | Yes      | -               |
| potential_revenue        | numeric                  | No          | Yes      | -               |
| referral_source          | text                     | No          | Yes      | -               |
| rs_fee_percent           | numeric                  | No          | Yes      | -               |
| rs_revenue               | numeric                  | No          | Yes      | -               |
| net_revenue              | numeric                  | No          | Yes      | -               |
| invoice_amount           | numeric                  | No          | Yes      | -               |
| actual_net_revenue       | numeric                  | No          | Yes      | -               |
| volume_log_status        | text                     | No          | Yes      | -               |
| sheets_row_index         | integer                  | No          | Yes      | -               |
| sheets_last_synced_at    | timestamp with time zone | No          | Yes      | -               |
| created_at               | timestamp with time zone | No          | No       | -               |
| updated_at               | timestamp with time zone | No          | No       | -               |
| deal_outcome             | USER-DEFINED             | No          | No       | -               |
| copper_opportunity_id    | text                     | No          | Yes      | -               |
| source_system            | text                     | No          | No       | -               |
| won_reason               | text                     | No          | Yes      | -               |
| won_at                   | timestamp with time zone | No          | Yes      | -               |
| lost_at                  | timestamp with time zone | No          | Yes      | -               |
| custom_fields            | jsonb                    | No          | No       | -               |
| interactions_count       | integer                  | No          | No       | -               |
| stage_changed_at         | timestamp with time zone | No          | Yes      | -               |

## Table: `lender_management_people`

| Column Name          | Data Type                | Primary Key | Nullable | Foreign Key To    |
| -------------------- | ------------------------ | ----------- | -------- | ----------------- |
| id                   | uuid                     | Yes         | No       | -                 |
| lender_management_id | uuid                     | No          | No       | lender_management |
| person_id            | uuid                     | No          | No       | people            |
| role                 | text                     | No          | Yes      | -                 |
| created_at           | timestamp with time zone | No          | No       | -                 |

## Table: `lender_programs`

| Column Name      | Data Type                | Primary Key | Nullable | Foreign Key To |
| ---------------- | ------------------------ | ----------- | -------- | -------------- |
| id               | uuid                     | Yes         | No       | -              |
| lender_name      | text                     | No          | No       | -              |
| lender_specialty | text                     | No          | Yes      | -              |
| program_name     | text                     | No          | No       | -              |
| program_type     | text                     | No          | No       | -              |
| description      | text                     | No          | Yes      | -              |
| min_loan         | numeric                  | No          | Yes      | -              |
| max_loan         | numeric                  | No          | Yes      | -              |
| interest_range   | text                     | No          | Yes      | -              |
| term             | text                     | No          | Yes      | -              |
| created_at       | timestamp with time zone | No          | No       | -              |
| updated_at       | timestamp with time zone | No          | No       | -              |
| call_status      | text                     | No          | Yes      | -              |
| last_contact     | timestamp with time zone | No          | Yes      | -              |
| next_call        | timestamp with time zone | No          | Yes      | -              |
| location         | text                     | No          | Yes      | -              |
| looking_for      | text                     | No          | Yes      | -              |
| contact_name     | text                     | No          | Yes      | -              |
| phone            | text                     | No          | Yes      | -              |
| email            | text                     | No          | Yes      | -              |
| lender_type      | text                     | No          | Yes      | -              |
| loan_types       | text                     | No          | Yes      | -              |
| states           | text                     | No          | Yes      | -              |
| loan_size_text   | text                     | No          | Yes      | -              |

## Table: `messages`

| Column Name     | Data Type                | Primary Key | Nullable | Foreign Key To |
| --------------- | ------------------------ | ----------- | -------- | -------------- |
| id              | uuid                     | Yes         | No       | -              |
| conversation_id | uuid                     | No          | No       | conversations  |
| sender_id       | uuid                     | No          | No       | -              |
| content         | text                     | No          | No       | -              |
| read_at         | timestamp with time zone | No          | Yes      | -              |
| created_at      | timestamp with time zone | No          | No       | -              |

## Table: `module_tasks`

| Column Name | Data Type                | Primary Key | Nullable | Foreign Key To |
| ----------- | ------------------------ | ----------- | -------- | -------------- |
| id          | uuid                     | Yes         | No       | -              |
| module_id   | uuid                     | No          | Yes      | modules        |
| title       | text                     | No          | No       | -              |
| status      | text                     | No          | No       | -              |
| created_at  | timestamp with time zone | No          | No       | -              |

## Table: `modules`

| Column Name    | Data Type                | Primary Key | Nullable | Foreign Key To |
| -------------- | ------------------------ | ----------- | -------- | -------------- |
| id             | uuid                     | Yes         | No       | -              |
| name           | text                     | No          | No       | -              |
| description    | text                     | No          | Yes      | -              |
| business_owner | text                     | No          | Yes      | -              |
| priority       | text                     | No          | No       | -              |
| status         | text                     | No          | No       | -              |
| icon           | text                     | No          | Yes      | -              |
| created_at     | timestamp with time zone | No          | No       | -              |
| updated_at     | timestamp with time zone | No          | No       | -              |
| portal         | text                     | No          | Yes      | -              |

## Table: `newsletter_campaign_events`

| Column Name   | Data Type                | Primary Key | Nullable | Foreign Key To       |
| ------------- | ------------------------ | ----------- | -------- | -------------------- |
| id            | uuid                     | Yes         | No       | -                    |
| campaign_id   | uuid                     | No          | No       | newsletter_campaigns |
| subscriber_id | uuid                     | No          | No       | -                    |
| event_type    | text                     | No          | No       | -                    |
| metadata      | jsonb                    | No          | Yes      | -                    |
| created_at    | timestamp with time zone | No          | No       | -                    |

## Table: `newsletter_campaigns`

| Column Name        | Data Type                | Primary Key | Nullable | Foreign Key To       |
| ------------------ | ------------------------ | ----------- | -------- | -------------------- |
| id                 | uuid                     | Yes         | No       | -                    |
| name               | text                     | No          | No       | -                    |
| subject            | text                     | No          | No       | -                    |
| content            | text                     | No          | Yes      | -                    |
| template_id        | uuid                     | No          | Yes      | newsletter_templates |
| status             | text                     | No          | No       | -                    |
| scheduled_for      | timestamp with time zone | No          | Yes      | -                    |
| sent_at            | timestamp with time zone | No          | Yes      | -                    |
| recipients_count   | integer                  | No          | Yes      | -                    |
| delivered_count    | integer                  | No          | Yes      | -                    |
| opened_count       | integer                  | No          | Yes      | -                    |
| clicked_count      | integer                  | No          | Yes      | -                    |
| unsubscribed_count | integer                  | No          | Yes      | -                    |
| bounced_count      | integer                  | No          | Yes      | -                    |
| created_at         | timestamp with time zone | No          | No       | -                    |
| updated_at         | timestamp with time zone | No          | No       | -                    |

## Table: `newsletter_templates`

| Column Name | Data Type                | Primary Key | Nullable | Foreign Key To |
| ----------- | ------------------------ | ----------- | -------- | -------------- |
| id          | uuid                     | Yes         | No       | -              |
| name        | text                     | No          | No       | -              |
| description | text                     | No          | Yes      | -              |
| subject     | text                     | No          | Yes      | -              |
| content     | text                     | No          | No       | -              |
| created_at  | timestamp with time zone | No          | No       | -              |
| updated_at  | timestamp with time zone | No          | No       | -              |

## Table: `notes`

| Column Name | Data Type                | Primary Key | Nullable | Foreign Key To |
| ----------- | ------------------------ | ----------- | -------- | -------------- |
| id          | uuid                     | Yes         | No       | -              |
| content     | text                     | No          | No       | -              |
| is_pinned   | boolean                  | No          | No       | -              |
| created_at  | timestamp with time zone | No          | No       | -              |
| updated_at  | timestamp with time zone | No          | No       | -              |
| user_id     | uuid                     | No          | Yes      | users          |
| entity_id   | uuid                     | No          | Yes      | -              |
| entity_type | USER-DEFINED             | No          | Yes      | -              |
| title       | text                     | No          | Yes      | -              |

## Table: `notifications`

| Column Name | Data Type                | Primary Key | Nullable | Foreign Key To |
| ----------- | ------------------------ | ----------- | -------- | -------------- |
| id          | uuid                     | Yes         | No       | -              |
| user_id     | uuid                     | No          | No       | users          |
| type        | text                     | No          | No       | -              |
| title       | text                     | No          | No       | -              |
| description | text                     | No          | Yes      | -              |
| link_url    | text                     | No          | Yes      | -              |
| is_read     | boolean                  | No          | Yes      | -              |
| created_at  | timestamp with time zone | No          | Yes      | -              |
| target_id   | text                     | No          | Yes      | -              |

## Table: `outbound_emails`

| Column Name       | Data Type                | Primary Key | Nullable | Foreign Key To |
| ----------------- | ------------------------ | ----------- | -------- | -------------- |
| id                | uuid                     | Yes         | No       | -              |
| user_id           | uuid                     | No          | No       | -              |
| flow_id           | text                     | No          | No       | -              |
| source            | text                     | No          | No       | -              |
| lead_id           | uuid                     | No          | Yes      | -              |
| to_email          | text                     | No          | No       | -              |
| subject           | text                     | No          | No       | -              |
| body_html         | text                     | No          | No       | -              |
| body_plain        | text                     | No          | No       | -              |
| gmail_message_id  | text                     | No          | Yes      | -              |
| gmail_thread_id   | text                     | No          | Yes      | -              |
| reply_thread_id   | text                     | No          | Yes      | -              |
| reply_in_reply_to | text                     | No          | Yes      | -              |
| status            | text                     | No          | No       | -              |
| error             | text                     | No          | Yes      | -              |
| sent_at           | timestamp with time zone | No          | Yes      | -              |
| created_at        | timestamp with time zone | No          | No       | -              |
| updated_at        | timestamp with time zone | No          | No       | -              |
| cc_emails         | text                     | No          | Yes      | -              |
| entity_type       | USER-DEFINED             | No          | Yes      | -              |

## Table: `partner_referrals`

| Column Name      | Data Type                | Primary Key | Nullable | Foreign Key To |
| ---------------- | ------------------------ | ----------- | -------- | -------------- |
| id               | uuid                     | Yes         | No       | -              |
| partner_id       | uuid                     | No          | No       | -              |
| lead_id          | uuid                     | No          | Yes      | -              |
| name             | text                     | No          | No       | -              |
| email            | text                     | No          | Yes      | -              |
| phone            | text                     | No          | Yes      | -              |
| company_name     | text                     | No          | Yes      | -              |
| loan_amount      | numeric                  | No          | Yes      | -              |
| loan_type        | text                     | No          | Yes      | -              |
| property_address | text                     | No          | Yes      | -              |
| urgency          | text                     | No          | Yes      | -              |
| notes            | text                     | No          | Yes      | -              |
| status           | text                     | No          | No       | -              |
| created_at       | timestamp with time zone | No          | No       | -              |
| updated_at       | timestamp with time zone | No          | No       | -              |
| entity_type      | USER-DEFINED             | No          | Yes      | -              |

## Table: `partner_tracking`

| Column Name       | Data Type                | Primary Key | Nullable | Foreign Key To    |
| ----------------- | ------------------------ | ----------- | -------- | ----------------- |
| id                | uuid                     | Yes         | No       | -                 |
| partner_id        | uuid                     | No          | No       | -                 |
| referral_id       | uuid                     | No          | No       | partner_referrals |
| tracking_status   | text                     | No          | No       | -                 |
| priority          | text                     | No          | No       | -                 |
| internal_notes    | text                     | No          | Yes      | -                 |
| last_contacted_at | timestamp with time zone | No          | Yes      | -                 |
| next_follow_up    | date                     | No          | Yes      | -                 |
| created_at        | timestamp with time zone | No          | No       | -                 |
| updated_at        | timestamp with time zone | No          | No       | -                 |

## Table: `people`

| Column Name      | Data Type                | Primary Key | Nullable | Foreign Key To |
| ---------------- | ------------------------ | ----------- | -------- | -------------- |
| id               | uuid                     | Yes         | No       | -              |
| name             | text                     | No          | No       | -              |
| email            | text                     | No          | Yes      | -              |
| phone            | text                     | No          | Yes      | -              |
| title            | text                     | No          | Yes      | -              |
| known_as         | text                     | No          | Yes      | -              |
| company_name     | text                     | No          | Yes      | -              |
| company_id       | uuid                     | No          | Yes      | companies      |
| contact_type     | text                     | No          | Yes      | -              |
| source           | text                     | No          | Yes      | -              |
| referral_source  | text                     | No          | Yes      | -              |
| assigned_to      | uuid                     | No          | Yes      | users          |
| about            | text                     | No          | Yes      | -              |
| notes            | text                     | No          | Yes      | -              |
| description      | text                     | No          | Yes      | -              |
| history          | text                     | No          | Yes      | -              |
| tags             | ARRAY                    | No          | Yes      | -              |
| linkedin         | text                     | No          | Yes      | -              |
| twitter          | text                     | No          | Yes      | -              |
| website          | text                     | No          | Yes      | -              |
| work_website     | text                     | No          | Yes      | -              |
| last_activity_at | timestamp with time zone | No          | Yes      | -              |
| last_contacted   | timestamp with time zone | No          | Yes      | -              |
| created_at       | timestamp with time zone | No          | No       | -              |
| updated_at       | timestamp with time zone | No          | No       | -              |
| copper_person_id | text                     | No          | Yes      | -              |
| source_system    | text                     | No          | No       | -              |

## Table: `person_connections`

| Column Name       | Data Type                | Primary Key | Nullable | Foreign Key To |
| ----------------- | ------------------------ | ----------- | -------- | -------------- |
| id                | uuid                     | Yes         | No       | -              |
| entity_id         | uuid                     | No          | No       | -              |
| connected_lead_id | uuid                     | No          | Yes      | -              |
| connected_name    | text                     | No          | Yes      | -              |
| connected_company | text                     | No          | Yes      | -              |
| relationship_type | text                     | No          | Yes      | -              |
| notes             | text                     | No          | Yes      | -              |
| created_at        | timestamp with time zone | No          | No       | -              |
| entity_type       | USER-DEFINED             | No          | Yes      | -              |

## Table: `person_other_contacts`

| Column Name   | Data Type                | Primary Key | Nullable | Foreign Key To |
| ------------- | ------------------------ | ----------- | -------- | -------------- |
| id            | uuid                     | Yes         | No       | -              |
| entity_id     | uuid                     | No          | No       | -              |
| contact_type  | text                     | No          | No       | -              |
| contact_value | text                     | No          | No       | -              |
| created_at    | timestamp with time zone | No          | No       | -              |
| entity_type   | USER-DEFINED             | No          | Yes      | -              |

## Table: `pipeline_shares`

| Column Name    | Data Type                | Primary Key | Nullable | Foreign Key To |
| -------------- | ------------------------ | ----------- | -------- | -------------- |
| id             | uuid                     | Yes         | No       | -              |
| owner_id       | uuid                     | No          | No       | users          |
| shared_with_id | uuid                     | No          | No       | users          |
| access_level   | text                     | No          | No       | -              |
| created_at     | timestamp with time zone | No          | No       | -              |
| created_by     | uuid                     | No          | Yes      | users          |
| updated_at     | timestamp with time zone | No          | No       | -              |

## Table: `pipeline_stages`

| Column Name | Data Type                | Primary Key | Nullable | Foreign Key To |
| ----------- | ------------------------ | ----------- | -------- | -------------- |
| id          | uuid                     | Yes         | No       | -              |
| pipeline_id | uuid                     | No          | No       | pipelines      |
| name        | text                     | No          | No       | -              |
| color       | text                     | No          | Yes      | -              |
| position    | integer                  | No          | No       | -              |
| created_at  | timestamp with time zone | No          | No       | -              |
| updated_at  | timestamp with time zone | No          | No       | -              |

## Table: `pipelines`

| Column Name   | Data Type                | Primary Key | Nullable | Foreign Key To |
| ------------- | ------------------------ | ----------- | -------- | -------------- |
| id            | uuid                     | Yes         | No       | -              |
| owner_id      | uuid                     | No          | No       | users          |
| name          | text                     | No          | No       | -              |
| description   | text                     | No          | Yes      | -              |
| color         | text                     | No          | Yes      | -              |
| icon          | text                     | No          | Yes      | -              |
| is_main       | boolean                  | No          | Yes      | -              |
| template_type | text                     | No          | Yes      | -              |
| created_at    | timestamp with time zone | No          | No       | -              |
| updated_at    | timestamp with time zone | No          | No       | -              |
| is_system     | boolean                  | No          | No       | -              |

## Table: `potential`

| Column Name                          | Data Type                | Primary Key | Nullable | Foreign Key To  |
| ------------------------------------ | ------------------------ | ----------- | -------- | --------------- |
| id                                   | uuid                     | Yes         | No       | -               |
| name                                 | text                     | No          | No       | -               |
| email                                | text                     | No          | Yes      | -               |
| phone                                | text                     | No          | Yes      | -               |
| company_name                         | text                     | No          | Yes      | -               |
| status                               | USER-DEFINED             | No          | No       | -               |
| stage_id                             | uuid                     | No          | Yes      | pipeline_stages |
| source                               | text                     | No          | Yes      | -               |
| notes                                | text                     | No          | Yes      | -               |
| assigned_to                          | uuid                     | No          | Yes      | users           |
| qualified_at                         | timestamp with time zone | No          | Yes      | -               |
| converted_at                         | timestamp with time zone | No          | Yes      | -               |
| converted_to_client_id               | uuid                     | No          | Yes      | -               |
| questionnaire_token                  | text                     | No          | Yes      | -               |
| questionnaire_sent_at                | timestamp with time zone | No          | Yes      | -               |
| questionnaire_completed_at           | timestamp with time zone | No          | Yes      | -               |
| known_as                             | text                     | No          | Yes      | -               |
| title                                | text                     | No          | Yes      | -               |
| contact_type                         | text                     | No          | Yes      | -               |
| tags                                 | ARRAY                    | No          | Yes      | -               |
| about                                | text                     | No          | Yes      | -               |
| website                              | text                     | No          | Yes      | -               |
| linkedin                             | text                     | No          | Yes      | -               |
| twitter                              | text                     | No          | Yes      | -               |
| next_action                          | text                     | No          | Yes      | -               |
| waiting_on                           | text                     | No          | Yes      | -               |
| sla_threshold_days                   | integer                  | No          | Yes      | -               |
| last_activity_at                     | timestamp with time zone | No          | Yes      | -               |
| ratewatch_questionnaire_token        | uuid                     | No          | Yes      | -               |
| ratewatch_questionnaire_sent_at      | timestamp with time zone | No          | Yes      | -               |
| ratewatch_questionnaire_completed_at | timestamp with time zone | No          | Yes      | -               |
| initial_nudge_created_at             | timestamp with time zone | No          | Yes      | -               |
| cohort_year                          | integer                  | No          | Yes      | -               |
| flagged_for_weekly                   | boolean                  | No          | No       | -               |
| uw_number                            | text                     | No          | Yes      | -               |
| client_other_lenders                 | boolean                  | No          | No       | -               |
| deal_value                           | numeric                  | No          | Yes      | -               |
| history                              | text                     | No          | Yes      | -               |
| bank_relationships                   | text                     | No          | Yes      | -               |
| opportunity_name                     | text                     | No          | Yes      | -               |
| clx_file_name                        | text                     | No          | Yes      | -               |
| description                          | text                     | No          | Yes      | -               |
| close_date                           | timestamp with time zone | No          | Yes      | -               |
| loss_reason                          | text                     | No          | Yes      | -               |
| priority                             | USER-DEFINED             | No          | Yes      | -               |
| win_percentage                       | integer                  | No          | Yes      | -               |
| visibility                           | text                     | No          | Yes      | -               |
| last_contacted                       | timestamp with time zone | No          | Yes      | -               |
| work_website                         | text                     | No          | Yes      | -               |
| target_closing_date                  | date                     | No          | Yes      | -               |
| clx_agreement                        | boolean                  | No          | Yes      | -               |
| loan_category                        | text                     | No          | Yes      | -               |
| wu_date                              | date                     | No          | Yes      | -               |
| loan_stage                           | text                     | No          | Yes      | -               |
| won                                  | boolean                  | No          | Yes      | -               |
| lender_type                          | text                     | No          | Yes      | -               |
| lender_name                          | text                     | No          | Yes      | -               |
| fee_percent                          | numeric                  | No          | Yes      | -               |
| potential_revenue                    | numeric                  | No          | Yes      | -               |
| referral_source                      | text                     | No          | Yes      | -               |
| rs_fee_percent                       | numeric                  | No          | Yes      | -               |
| rs_revenue                           | numeric                  | No          | Yes      | -               |
| net_revenue                          | numeric                  | No          | Yes      | -               |
| invoice_amount                       | numeric                  | No          | Yes      | -               |
| actual_net_revenue                   | numeric                  | No          | Yes      | -               |
| volume_log_status                    | text                     | No          | Yes      | -               |
| sheets_row_index                     | integer                  | No          | Yes      | -               |
| sheets_last_synced_at                | timestamp with time zone | No          | Yes      | -               |
| created_at                           | timestamp with time zone | No          | No       | -               |
| updated_at                           | timestamp with time zone | No          | No       | -               |
| deal_outcome                         | USER-DEFINED             | No          | No       | -               |
| copper_opportunity_id                | text                     | No          | Yes      | -               |
| source_system                        | text                     | No          | No       | -               |
| won_reason                           | text                     | No          | Yes      | -               |
| won_at                               | timestamp with time zone | No          | Yes      | -               |
| lost_at                              | timestamp with time zone | No          | Yes      | -               |
| custom_fields                        | jsonb                    | No          | No       | -               |
| interactions_count                   | integer                  | No          | No       | -               |
| stage_changed_at                     | timestamp with time zone | No          | Yes      | -               |

## Table: `potential_people`

| Column Name  | Data Type                | Primary Key | Nullable | Foreign Key To |
| ------------ | ------------------------ | ----------- | -------- | -------------- |
| id           | uuid                     | Yes         | No       | -              |
| potential_id | uuid                     | No          | No       | potential      |
| person_id    | uuid                     | No          | No       | people         |
| role         | text                     | No          | Yes      | -              |
| created_at   | timestamp with time zone | No          | No       | -              |

## Table: `project_people`

| Column Name | Data Type                | Primary Key | Nullable | Foreign Key To  |
| ----------- | ------------------------ | ----------- | -------- | --------------- |
| id          | uuid                     | Yes         | No       | -               |
| project_id  | uuid                     | No          | No       | entity_projects |
| lead_id     | uuid                     | No          | No       | -               |
| role        | text                     | No          | Yes      | -               |
| created_at  | timestamp with time zone | No          | No       | -               |
| entity_type | USER-DEFINED             | No          | Yes      | -               |

## Table: `rate_limits`

| Column Name   | Data Type                | Primary Key | Nullable | Foreign Key To |
| ------------- | ------------------------ | ----------- | -------- | -------------- |
| id            | uuid                     | Yes         | No       | -              |
| ip_address    | text                     | No          | No       | -              |
| function_name | text                     | No          | No       | -              |
| request_count | integer                  | No          | No       | -              |
| window_start  | timestamp with time zone | No          | No       | -              |

## Table: `rate_watch`

| Column Name           | Data Type                | Primary Key | Nullable | Foreign Key To |
| --------------------- | ------------------------ | ----------- | -------- | -------------- |
| id                    | uuid                     | Yes         | No       | -              |
| lead_id               | uuid                     | No          | No       | potential      |
| current_rate          | numeric                  | No          | No       | -              |
| target_rate           | numeric                  | No          | No       | -              |
| loan_type             | text                     | No          | Yes      | -              |
| loan_amount           | numeric                  | No          | Yes      | -              |
| enrolled_at           | timestamp with time zone | No          | No       | -              |
| last_contacted_at     | timestamp with time zone | No          | Yes      | -              |
| notes                 | text                     | No          | Yes      | -              |
| is_active             | boolean                  | No          | No       | -              |
| created_at            | timestamp with time zone | No          | No       | -              |
| updated_at            | timestamp with time zone | No          | No       | -              |
| confirm_email         | boolean                  | No          | Yes      | -              |
| initial_review        | text                     | No          | Yes      | -              |
| collateral_type       | text                     | No          | Yes      | -              |
| collateral_value      | numeric                  | No          | Yes      | -              |
| loan_maturity         | date                     | No          | Yes      | -              |
| re_location           | text                     | No          | Yes      | -              |
| rate_type             | text                     | No          | Yes      | -              |
| variable_index_spread | text                     | No          | Yes      | -              |
| original_term_years   | numeric                  | No          | Yes      | -              |
| amortization          | text                     | No          | Yes      | -              |
| penalty               | text                     | No          | Yes      | -              |
| lender_type           | text                     | No          | Yes      | -              |
| estimated_cf          | numeric                  | No          | Yes      | -              |
| occupancy_use         | text                     | No          | Yes      | -              |
| owner_occupied_pct    | numeric                  | No          | Yes      | -              |
| seeking_to_improve    | text                     | No          | Yes      | -              |
| entity_type           | USER-DEFINED             | No          | Yes      | -              |

## Table: `ratewatch_questionnaire_responses`

| Column Name           | Data Type                | Primary Key | Nullable | Foreign Key To |
| --------------------- | ------------------------ | ----------- | -------- | -------------- |
| id                    | uuid                     | Yes         | No       | -              |
| lead_id               | uuid                     | No          | Yes      | -              |
| first_name            | text                     | No          | Yes      | -              |
| last_name             | text                     | No          | Yes      | -              |
| email                 | text                     | No          | Yes      | -              |
| phone                 | text                     | No          | Yes      | -              |
| contact_method        | text                     | No          | Yes      | -              |
| current_lender        | text                     | No          | Yes      | -              |
| loan_balance          | numeric                  | No          | Yes      | -              |
| current_rate          | numeric                  | No          | Yes      | -              |
| target_rate           | numeric                  | No          | Yes      | -              |
| loan_maturity         | date                     | No          | Yes      | -              |
| loan_type             | text                     | No          | Yes      | -              |
| rate_type             | text                     | No          | Yes      | -              |
| variable_index_spread | text                     | No          | Yes      | -              |
| original_term_years   | numeric                  | No          | Yes      | -              |
| amortization          | text                     | No          | Yes      | -              |
| prepayment_penalty    | text                     | No          | Yes      | -              |
| lender_type           | text                     | No          | Yes      | -              |
| collateral_type       | text                     | No          | Yes      | -              |
| collateral_value      | numeric                  | No          | Yes      | -              |
| re_city_state         | text                     | No          | Yes      | -              |
| property_occupancy    | text                     | No          | Yes      | -              |
| owner_occupied_pct    | numeric                  | No          | Yes      | -              |
| estimated_cash_flow   | numeric                  | No          | Yes      | -              |
| business_description  | text                     | No          | Yes      | -              |
| seeking_to_improve    | text                     | No          | Yes      | -              |
| additional_notes      | text                     | No          | Yes      | -              |
| submitted_at          | timestamp with time zone | No          | No       | -              |
| created_at            | timestamp with time zone | No          | No       | -              |
| entity_type           | USER-DEFINED             | No          | Yes      | -              |

## Table: `revenue_targets`

| Column Name         | Data Type                | Primary Key | Nullable | Foreign Key To |
| ------------------- | ------------------------ | ----------- | -------- | -------------- |
| id                  | uuid                     | Yes         | No       | -              |
| period_type         | text                     | No          | No       | -              |
| target_amount       | numeric                  | No          | No       | -              |
| current_amount      | numeric                  | No          | No       | -              |
| forecast_amount     | numeric                  | No          | No       | -              |
| forecast_confidence | integer                  | No          | No       | -              |
| pace_vs_plan        | integer                  | No          | No       | -              |
| created_at          | timestamp with time zone | No          | No       | -              |
| updated_at          | timestamp with time zone | No          | No       | -              |

## Table: `sheets_connections`

| Column Name               | Data Type                | Primary Key | Nullable | Foreign Key To |
| ------------------------- | ------------------------ | ----------- | -------- | -------------- |
| id                        | uuid                     | Yes         | No       | -              |
| user_id                   | uuid                     | No          | No       | -              |
| user_name                 | text                     | No          | Yes      | -              |
| email                     | character varying        | No          | No       | -              |
| access_token              | text                     | No          | No       | -              |
| refresh_token             | text                     | No          | No       | -              |
| token_expiry              | timestamp with time zone | No          | No       | -              |
| created_at                | timestamp with time zone | No          | No       | -              |
| updated_at                | timestamp with time zone | No          | No       | -              |
| drive_watch_channel_token | text                     | No          | Yes      | -              |

## Table: `task_activities`

| Column Name     | Data Type                | Primary Key | Nullable | Foreign Key To |
| --------------- | ------------------------ | ----------- | -------- | -------------- |
| id              | uuid                     | Yes         | No       | -              |
| task_id         | uuid                     | No          | No       | tasks          |
| activity_type   | text                     | No          | No       | -              |
| content         | text                     | No          | Yes      | -              |
| old_value       | text                     | No          | Yes      | -              |
| new_value       | text                     | No          | Yes      | -              |
| created_by      | text                     | No          | Yes      | -              |
| mentioned_users | ARRAY                    | No          | Yes      | -              |
| created_at      | timestamp with time zone | No          | No       | -              |
| user_id         | uuid                     | No          | Yes      | users          |

## Table: `task_saved_filters`

| Column Name | Data Type                | Primary Key | Nullable | Foreign Key To |
| ----------- | ------------------------ | ----------- | -------- | -------------- |
| id          | uuid                     | Yes         | No       | -              |
| name        | text                     | No          | No       | -              |
| description | text                     | No          | Yes      | -              |
| visibility  | text                     | No          | No       | -              |
| criteria    | jsonb                    | No          | No       | -              |
| created_by  | uuid                     | No          | Yes      | users          |
| position    | integer                  | No          | No       | -              |
| created_at  | timestamp with time zone | No          | Yes      | -              |
| updated_at  | timestamp with time zone | No          | Yes      | -              |

## Table: `tasks`

| Column Name     | Data Type                | Primary Key | Nullable | Foreign Key To |
| --------------- | ------------------------ | ----------- | -------- | -------------- |
| id              | uuid                     | Yes         | No       | -              |
| title           | text                     | No          | No       | -              |
| description     | text                     | No          | Yes      | -              |
| is_completed    | boolean                  | No          | No       | -              |
| due_date        | timestamp with time zone | No          | Yes      | -              |
| priority        | text                     | No          | Yes      | -              |
| created_at      | timestamp with time zone | No          | No       | -              |
| updated_at      | timestamp with time zone | No          | No       | -              |
| status          | text                     | No          | Yes      | -              |
| estimated_hours | numeric                  | No          | Yes      | -              |
| group_name      | text                     | No          | Yes      | -              |
| tags            | ARRAY                    | No          | Yes      | -              |
| lead_id         | uuid                     | No          | Yes      | potential      |
| source          | text                     | No          | Yes      | -              |
| task_type       | text                     | No          | Yes      | -              |
| user_id         | uuid                     | No          | Yes      | users          |
| completed_at    | timestamp with time zone | No          | Yes      | -              |
| created_by      | text                     | No          | Yes      | -              |
| entity_type     | USER-DEFINED             | No          | Yes      | -              |
| copper_task_id  | text                     | No          | Yes      | -              |
| source_system   | text                     | No          | No       | -              |

## Table: `team_monthly_goals`

| Column Name   | Data Type                | Primary Key | Nullable | Foreign Key To |
| ------------- | ------------------------ | ----------- | -------- | -------------- |
| id            | uuid                     | Yes         | No       | -              |
| goal_label    | text                     | No          | No       | -              |
| current_value | integer                  | No          | No       | -              |
| target_value  | integer                  | No          | No       | -              |
| created_at    | timestamp with time zone | No          | Yes      | -              |
| updated_at    | timestamp with time zone | No          | Yes      | -              |
| user_id       | uuid                     | No          | Yes      | users          |

## Table: `underwriting`

| Column Name              | Data Type                | Primary Key | Nullable | Foreign Key To  |
| ------------------------ | ------------------------ | ----------- | -------- | --------------- |
| id                       | uuid                     | Yes         | No       | -               |
| name                     | text                     | No          | No       | -               |
| email                    | text                     | No          | Yes      | -               |
| phone                    | text                     | No          | Yes      | -               |
| company_name             | text                     | No          | Yes      | -               |
| status                   | USER-DEFINED             | No          | No       | -               |
| stage_id                 | uuid                     | No          | Yes      | pipeline_stages |
| origin_pipeline_id       | uuid                     | No          | Yes      | potential       |
| source                   | text                     | No          | Yes      | -               |
| notes                    | text                     | No          | Yes      | -               |
| assigned_to              | uuid                     | No          | Yes      | users           |
| qualified_at             | timestamp with time zone | No          | Yes      | -               |
| converted_at             | timestamp with time zone | No          | Yes      | -               |
| converted_to_client_id   | uuid                     | No          | Yes      | -               |
| known_as                 | text                     | No          | Yes      | -               |
| title                    | text                     | No          | Yes      | -               |
| contact_type             | text                     | No          | Yes      | -               |
| tags                     | ARRAY                    | No          | Yes      | -               |
| about                    | text                     | No          | Yes      | -               |
| next_action              | text                     | No          | Yes      | -               |
| waiting_on               | text                     | No          | Yes      | -               |
| sla_threshold_days       | integer                  | No          | Yes      | -               |
| last_activity_at         | timestamp with time zone | No          | Yes      | -               |
| initial_nudge_created_at | timestamp with time zone | No          | Yes      | -               |
| cohort_year              | integer                  | No          | Yes      | -               |
| flagged_for_weekly       | boolean                  | No          | No       | -               |
| uw_number                | text                     | No          | Yes      | -               |
| client_other_lenders     | boolean                  | No          | No       | -               |
| deal_value               | numeric                  | No          | Yes      | -               |
| history                  | text                     | No          | Yes      | -               |
| bank_relationships       | text                     | No          | Yes      | -               |
| opportunity_name         | text                     | No          | Yes      | -               |
| clx_file_name            | text                     | No          | Yes      | -               |
| description              | text                     | No          | Yes      | -               |
| close_date               | timestamp with time zone | No          | Yes      | -               |
| loss_reason              | text                     | No          | Yes      | -               |
| priority                 | USER-DEFINED             | No          | Yes      | -               |
| win_percentage           | integer                  | No          | Yes      | -               |
| visibility               | text                     | No          | Yes      | -               |
| last_contacted           | timestamp with time zone | No          | Yes      | -               |
| target_closing_date      | date                     | No          | Yes      | -               |
| clx_agreement            | boolean                  | No          | Yes      | -               |
| loan_category            | text                     | No          | Yes      | -               |
| wu_date                  | date                     | No          | Yes      | -               |
| loan_stage               | text                     | No          | Yes      | -               |
| won                      | boolean                  | No          | Yes      | -               |
| lender_type              | text                     | No          | Yes      | -               |
| lender_name              | text                     | No          | Yes      | -               |
| fee_percent              | numeric                  | No          | Yes      | -               |
| potential_revenue        | numeric                  | No          | Yes      | -               |
| referral_source          | text                     | No          | Yes      | -               |
| rs_fee_percent           | numeric                  | No          | Yes      | -               |
| rs_revenue               | numeric                  | No          | Yes      | -               |
| net_revenue              | numeric                  | No          | Yes      | -               |
| invoice_amount           | numeric                  | No          | Yes      | -               |
| actual_net_revenue       | numeric                  | No          | Yes      | -               |
| volume_log_status        | text                     | No          | Yes      | -               |
| sheets_row_index         | integer                  | No          | Yes      | -               |
| sheets_last_synced_at    | timestamp with time zone | No          | Yes      | -               |
| created_at               | timestamp with time zone | No          | No       | -               |
| updated_at               | timestamp with time zone | No          | No       | -               |
| deal_outcome             | USER-DEFINED             | No          | No       | -               |
| copper_opportunity_id    | text                     | No          | Yes      | -               |
| source_system            | text                     | No          | No       | -               |
| won_reason               | text                     | No          | Yes      | -               |
| won_at                   | timestamp with time zone | No          | Yes      | -               |
| lost_at                  | timestamp with time zone | No          | Yes      | -               |
| custom_fields            | jsonb                    | No          | No       | -               |
| interactions_count       | integer                  | No          | No       | -               |
| stage_changed_at         | timestamp with time zone | No          | Yes      | -               |

## Table: `underwriting_checklist_items`

| Column Name  | Data Type                | Primary Key | Nullable | Foreign Key To          |
| ------------ | ------------------------ | ----------- | -------- | ----------------------- |
| id           | uuid                     | Yes         | No       | -                       |
| checklist_id | uuid                     | No          | No       | underwriting_checklists |
| text         | text                     | No          | No       | -                       |
| is_checked   | boolean                  | No          | No       | -                       |
| position     | integer                  | No          | No       | -                       |
| created_at   | timestamp with time zone | No          | No       | -                       |
| due_date     | date                     | No          | Yes      | -                       |
| assigned_to  | text                     | No          | Yes      | -                       |

## Table: `underwriting_checklists`

| Column Name | Data Type                | Primary Key | Nullable | Foreign Key To |
| ----------- | ------------------------ | ----------- | -------- | -------------- |
| id          | uuid                     | Yes         | No       | -              |
| entity_id   | uuid                     | No          | No       | -              |
| title       | text                     | No          | No       | -              |
| created_by  | text                     | No          | Yes      | -              |
| activity_id | uuid                     | No          | Yes      | activities     |
| created_at  | timestamp with time zone | No          | No       | -              |
| entity_type | USER-DEFINED             | No          | Yes      | -              |

## Table: `underwriting_people`

| Column Name     | Data Type                | Primary Key | Nullable | Foreign Key To |
| --------------- | ------------------------ | ----------- | -------- | -------------- |
| id              | uuid                     | Yes         | No       | -              |
| underwriting_id | uuid                     | No          | No       | underwriting   |
| person_id       | uuid                     | No          | No       | people         |
| role            | text                     | No          | Yes      | -              |
| created_at      | timestamp with time zone | No          | No       | -              |

## Table: `users`

| Column Name         | Data Type                | Primary Key | Nullable | Foreign Key To |
| ------------------- | ------------------------ | ----------- | -------- | -------------- |
| id                  | uuid                     | Yes         | No       | -              |
| name                | text                     | No          | No       | -              |
| email               | text                     | No          | Yes      | -              |
| phone               | text                     | No          | Yes      | -              |
| position            | text                     | No          | Yes      | -              |
| avatar_url          | text                     | No          | Yes      | -              |
| is_active           | boolean                  | No          | No       | -              |
| created_at          | timestamp with time zone | No          | No       | -              |
| updated_at          | timestamp with time zone | No          | No       | -              |
| user_id             | uuid                     | No          | Yes      | -              |
| is_owner            | boolean                  | No          | Yes      | -              |
| app_role            | USER-DEFINED             | No          | Yes      | -              |
| company_name        | text                     | No          | Yes      | -              |
| contact_person      | text                     | No          | Yes      | -              |
| address             | text                     | No          | Yes      | -              |
| city                | text                     | No          | Yes      | -              |
| state               | text                     | No          | Yes      | -              |
| zip_code            | text                     | No          | Yes      | -              |
| is_assignable       | boolean                  | No          | No       | -              |
| twilio_phone_number | text                     | No          | Yes      | -              |

## Table: `volume_log_sync_config`

| Column Name    | Data Type                | Primary Key | Nullable | Foreign Key To |
| -------------- | ------------------------ | ----------- | -------- | -------------- |
| id             | uuid                     | Yes         | No       | -              |
| spreadsheet_id | text                     | No          | No       | -              |
| sheet_name     | text                     | No          | Yes      | -              |
| column_mapping | jsonb                    | No          | No       | -              |
| header_row     | jsonb                    | No          | Yes      | -              |
| last_pull_at   | timestamp with time zone | No          | Yes      | -              |
| last_push_at   | timestamp with time zone | No          | Yes      | -              |
| created_by     | uuid                     | No          | Yes      | -              |
| created_at     | timestamp with time zone | No          | Yes      | -              |
| updated_at     | timestamp with time zone | No          | Yes      | -              |

