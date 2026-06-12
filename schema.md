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
| related_type       | USER-DEFINED             | No          | Yes      | -              |
| user_id           | uuid                     | No          | Yes      | users          |

## Table: `activities`

| Column Name        | Data Type                | Primary Key | Nullable | Foreign Key To |
| ------------------ | ------------------------ | ----------- | -------- | -------------- |
| id                 | uuid                     | Yes         | No       | -              |
| related_id          | uuid                     | No          | No       | -              |
| activity_type      | text                     | No          | No       | -              |
| title              | text                     | No          | Yes      | -              |
| content            | text                     | No          | Yes      | -              |
| created_by         | uuid                     | No          | Yes      | users          |
| created_at         | timestamp with time zone | No          | No       | -              |
| related_type        | USER-DEFINED             | No          | Yes      | -              |
| copper_activity_id | text                     | No          | Yes      | -              |
| source_system      | text                     | No          | No       | -              |

## Table: `activity_comments`

| Column Name | Data Type                | Primary Key | Nullable | Foreign Key To |
| ----------- | ------------------------ | ----------- | -------- | -------------- |
| id          | uuid                     | Yes         | No       | -              |
| activity_id | uuid                     | No          | No       | activities     |
| lead_id     | uuid                     | No          | No       | -              |
| content     | text                     | No          | No       | -              |
| created_by  | uuid                     | No          | Yes      | users          |
| created_at  | timestamp with time zone | No          | No       | -              |
| related_type | USER-DEFINED             | No          | Yes      | -              |

## Table: `ai_events`

| Column Name | Data Type                | Primary Key | Nullable | Foreign Key To |
| ----------- | ------------------------ | ----------- | -------- | -------------- |
| id          | uuid                     | Yes         | No       | -              |
| event_type  | USER-DEFINED             | No          | No       | -              |
| user_id     | uuid                     | No          | Yes      | -              |
| parent_id   | uuid                     | No          | Yes      | ai_events      |
| created_at  | timestamp with time zone | No          | No       | -              |
| updated_at  | timestamp with time zone | No          | No       | -              |
| payload     | jsonb                    | No          | No       | -              |

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
| user_id            | uuid                     | No          | Yes      | users          |
| related_type        | USER-DEFINED             | No          | Yes      | -              |

## Table: `bug_reports`

| Column Name        | Data Type                | Primary Key | Nullable | Foreign Key To |
| ------------------ | ------------------------ | ----------- | -------- | -------------- |
| id                 | uuid                     | Yes         | No       | -              |
| title              | text                     | No          | No       | -              |
| description        | text                     | No          | Yes      | -              |
| priority           | text                     | No          | Yes      | -              |
| status             | text                     | No          | Yes      | -              |
| submitted_by       | uuid                     | No          | Yes      | users          |
| submitted_by_email | text                     | No          | Yes      | -              |
| screenshot_url     | text                     | No          | Yes      | -              |
| page_url           | text                     | No          | Yes      | -              |
| browser_info       | text                     | No          | Yes      | -              |
| created_at         | timestamp with time zone | No          | No       | -              |
| updated_at         | timestamp with time zone | No          | No       | -              |
| resolved_at        | timestamp with time zone | No          | Yes      | -              |
| assigned_to_id     | uuid                     | No          | Yes      | users          |
| solution           | text                     | No          | Yes      | -              |

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
| related_type              | USER-DEFINED             | No          | Yes      | -              |

## Table: `communications`

| Column Name              | Data Type                | Primary Key | Nullable | Foreign Key To |
| ------------------------ | ------------------------ | ----------- | -------- | -------------- |
| id                       | uuid                     | Yes         | No       | -              |
| lead_id                  | uuid                     | No          | Yes      | -              |
| communication_type       | text                     | No          | No       | -              |
| direction                | text                     | No          | No       | -              |
| content                  | text                     | No          | Yes      | -              |
| phone_number             | text                     | No          | Yes      | -              |
| duration_seconds         | integer                  | No          | Yes      | -              |
| status                   | text                     | No          | Yes      | -              |
| created_at               | timestamp with time zone | No          | No       | -              |
| transcript               | text                     | No          | Yes      | -              |
| recording_url            | text                     | No          | Yes      | -              |
| recording_sid            | text                     | No          | Yes      | -              |
| call_sid                 | text                     | No          | Yes      | -              |
| user_id                  | uuid                     | No          | Yes      | users          |
| related_type              | USER-DEFINED             | No          | Yes      | -              |
| recording_status         | text                     | No          | Yes      | -              |
| transcription_status     | text                     | No          | Yes      | -              |
| transcription_error      | text                     | No          | Yes      | -              |
| transcription_updated_at | timestamp with time zone | No          | Yes      | -              |
| transcription_attempts   | integer                  | No          | No       | -              |

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
| related_id         | uuid                     | No          | No       | related       |

## Table: `company_people`

| Column Name | Data Type                | Primary Key | Nullable | Foreign Key To |
| ----------- | ------------------------ | ----------- | -------- | -------------- |
| id          | uuid                     | Yes         | No       | -              |
| company_id  | uuid                     | No          | No       | companies      |
| person_id   | uuid                     | No          | No       | people         |
| role        | text                     | No          | Yes      | -              |
| created_at  | timestamp with time zone | No          | No       | -              |

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

## Table: `deal_contacts`

| Column Name | Data Type                | Primary Key | Nullable | Foreign Key To |
| ----------- | ------------------------ | ----------- | -------- | -------------- |
| id          | uuid                     | Yes         | No       | -              |
| related_id   | uuid                     | No          | Yes      | -              |
| name        | text                     | No          | No       | -              |
| title       | text                     | No          | Yes      | -              |
| email       | text                     | No          | Yes      | -              |
| phone       | text                     | No          | Yes      | -              |
| is_primary  | boolean                  | No          | Yes      | -              |
| notes       | text                     | No          | Yes      | -              |
| created_at  | timestamp with time zone | No          | No       | -              |
| updated_at  | timestamp with time zone | No          | No       | -              |
| related_type | USER-DEFINED             | No          | Yes      | -              |
| deal_id     | uuid                     | No          | No       | deals          |

## Table: `deal_lender_programs`

| Column Name | Data Type                | Primary Key | Nullable | Foreign Key To  |
| ----------- | ------------------------ | ----------- | -------- | --------------- |
| id          | uuid                     | Yes         | No       | -               |
| related_id   | uuid                     | No          | No       | -               |
| program_id  | uuid                     | No          | No       | lender_programs |
| notes       | text                     | No          | Yes      | -               |
| status      | text                     | No          | Yes      | -               |
| created_at  | timestamp with time zone | No          | No       | -               |
| updated_at  | timestamp with time zone | No          | No       | -               |
| related_type | USER-DEFINED             | No          | Yes      | -               |

## Table: `deal_milestones`

| Column Name    | Data Type                | Primary Key | Nullable | Foreign Key To |
| -------------- | ------------------------ | ----------- | -------- | -------------- |
| id             | uuid                     | Yes         | No       | -              |
| lead_id        | uuid                     | No          | No       | -              |
| milestone_name | text                     | No          | No       | -              |
| completed      | boolean                  | No          | No       | -              |
| completed_by   | uuid                     | No          | Yes      | users          |
| completed_at   | timestamp with time zone | No          | Yes      | -              |
| notes          | text                     | No          | Yes      | -              |
| position       | integer                  | No          | No       | -              |
| created_at     | timestamp with time zone | No          | No       | -              |
| updated_at     | timestamp with time zone | No          | No       | -              |
| related_type    | USER-DEFINED             | No          | Yes      | -              |

## Table: `deal_people`

| Column Name | Data Type                | Primary Key | Nullable | Foreign Key To |
| ----------- | ------------------------ | ----------- | -------- | -------------- |
| id          | uuid                     | Yes         | No       | -              |
| deal_id     | uuid                     | No          | No       | deals          |
| person_id   | uuid                     | No          | No       | people         |
| role        | text                     | No          | Yes      | -              |
| created_at  | timestamp with time zone | No          | No       | -              |

## Table: `deal_waiting_on`

| Column Name | Data Type                | Primary Key | Nullable | Foreign Key To |
| ----------- | ------------------------ | ----------- | -------- | -------------- |
| id          | uuid                     | Yes         | No       | -              |
| lead_id     | uuid                     | No          | No       | -              |
| owner       | text                     | No          | No       | -              |
| description | text                     | No          | Yes      | -              |
| due_date    | timestamp with time zone | No          | Yes      | -              |
| resolved_at | timestamp with time zone | No          | Yes      | -              |
| resolved_by | uuid                     | No          | Yes      | users          |
| created_at  | timestamp with time zone | No          | No       | -              |
| updated_at  | timestamp with time zone | No          | No       | -              |
| related_type | USER-DEFINED             | No          | Yes      | -              |

## Table: `deals`

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
| pipeline                             | USER-DEFINED             | No          | No       | -               |
| related_id                            | uuid                     | No          | No       | related        |

## Table: `dropbox_connections`

| Column Name   | Data Type                | Primary Key | Nullable | Foreign Key To |
| ------------- | ------------------------ | ----------- | -------- | -------------- |
| id            | uuid                     | Yes         | No       | -              |
| user_id       | uuid                     | No          | No       | users          |
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
| lead_id              | uuid                     | No          | Yes      | deals          |
| synced_at            | timestamp with time zone | No          | Yes      | -              |
| created_at           | timestamp with time zone | No          | Yes      | -              |
| updated_at           | timestamp with time zone | No          | Yes      | -              |
| related_type          | USER-DEFINED             | No          | Yes      | -              |
| user_id              | uuid                     | No          | No       | -              |

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
| lead_id            | uuid                     | No          | Yes      | deals          |
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
| related_type        | USER-DEFINED             | No          | Yes      | -              |

## Table: `related`

| Column Name  | Data Type                | Primary Key | Nullable | Foreign Key To |
| ------------ | ------------------------ | ----------- | -------- | -------------- |
| id           | uuid                     | Yes         | No       | -              |
| kind         | USER-DEFINED             | No          | No       | -              |
| source_id    | uuid                     | No          | No       | -              |
| display_name | text                     | No          | Yes      | -              |
| created_at   | timestamp with time zone | No          | No       | -              |
| updated_at   | timestamp with time zone | No          | No       | -              |

## Table: `related_addresses`

| Column Name    | Data Type                | Primary Key | Nullable | Foreign Key To |
| -------------- | ------------------------ | ----------- | -------- | -------------- |
| id             | uuid                     | Yes         | No       | -              |
| related_id      | uuid                     | No          | No       | related       |
| address_type   | text                     | No          | Yes      | -              |
| address_line_1 | text                     | No          | Yes      | -              |
| address_line_2 | text                     | No          | Yes      | -              |
| city           | text                     | No          | Yes      | -              |
| state          | text                     | No          | Yes      | -              |
| zip_code       | text                     | No          | Yes      | -              |
| country        | text                     | No          | Yes      | -              |
| is_primary     | boolean                  | No          | Yes      | -              |
| created_at     | timestamp with time zone | No          | No       | -              |
| related_type    | USER-DEFINED             | No          | Yes      | -              |

## Table: `related_contact_points`

| Column Name  | Data Type                | Primary Key | Nullable | Foreign Key To |
| ------------ | ------------------------ | ----------- | -------- | -------------- |
| id           | uuid                     | Yes         | No       | -              |
| related_id   | uuid                     | No          | No       | related        |
| related_type | USER-DEFINED             | No          | Yes      | -              |
| kind         | text                     | No          | No       | -              |
| value        | text                     | No          | No       | -              |
| label        | text                     | No          | Yes      | -              |
| is_primary   | boolean                  | No          | Yes      | -              |
| created_at   | timestamp with time zone | No          | No       | -              |

## Table: `related_files`

| Column Name    | Data Type                | Primary Key | Nullable | Foreign Key To |
| -------------- | ------------------------ | ----------- | -------- | -------------- |
| id             | uuid                     | Yes         | No       | -              |
| related_id      | uuid                     | No          | No       | related       |
| file_name      | text                     | No          | No       | -              |
| file_url       | text                     | No          | No       | -              |
| file_type      | text                     | No          | Yes      | -              |
| file_size      | bigint                   | No          | Yes      | -              |
| uploaded_by    | uuid                     | No          | Yes      | users          |
| created_at     | timestamp with time zone | No          | No       | -              |
| related_type    | USER-DEFINED             | No          | Yes      | -              |
| copper_file_id | text                     | No          | Yes      | -              |
| source_system  | text                     | No          | No       | -              |

## Table: `related_followers`

| Column Name | Data Type                | Primary Key | Nullable | Foreign Key To |
| ----------- | ------------------------ | ----------- | -------- | -------------- |
| id          | uuid                     | Yes         | No       | -              |
| related_id   | uuid                     | No          | No       | related       |
| user_id     | uuid                     | No          | No       | users          |
| created_at  | timestamp with time zone | No          | Yes      | -              |
| related_type | USER-DEFINED             | No          | Yes      | -              |

## Table: `related_projects`

| Column Name        | Data Type                | Primary Key | Nullable | Foreign Key To |
| ------------------ | ------------------------ | ----------- | -------- | -------------- |
| id                 | uuid                     | Yes         | No       | -              |
| related_id          | uuid                     | No          | No       | related       |
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
| created_by         | uuid                     | No          | Yes      | users          |
| created_at         | timestamp with time zone | No          | No       | -              |
| updated_at         | timestamp with time zone | No          | No       | -              |
| related_type        | USER-DEFINED             | No          | Yes      | -              |

## Table: `feed_reactions`

| Column Name | Data Type                | Primary Key | Nullable | Foreign Key To |
| ----------- | ------------------------ | ----------- | -------- | -------------- |
| id          | uuid                     | Yes         | No       | -              |
| activity_id | text                     | No          | No       | -              |
| emoji       | text                     | No          | No       | -              |
| user_id     | uuid                     | No          | No       | users          |
| created_at  | timestamp with time zone | No          | No       | -              |

## Table: `google_connections`

| Column Name                | Data Type                | Primary Key | Nullable | Foreign Key To |
| -------------------------- | ------------------------ | ----------- | -------- | -------------- |
| id                         | uuid                     | Yes         | No       | -              |
| user_id                    | uuid                     | No          | No       | users          |
| email                      | character varying        | No          | No       | -              |
| access_token               | text                     | No          | No       | -              |
| refresh_token              | text                     | No          | No       | -              |
| token_expiry               | timestamp with time zone | No          | No       | -              |
| scopes                     | text                     | No          | Yes      | -              |
| calendar_id                | text                     | No          | Yes      | -              |
| drive_watch_channel_id     | text                     | No          | Yes      | -              |
| drive_watch_channel_token  | text                     | No          | Yes      | -              |
| drive_watch_resource_id    | text                     | No          | Yes      | -              |
| drive_watch_expiry         | timestamp with time zone | No          | Yes      | -              |
| drive_watch_spreadsheet_id | text                     | No          | Yes      | -              |
| created_at                 | timestamp with time zone | No          | No       | -              |
| updated_at                 | timestamp with time zone | No          | No       | -              |
| needs_reauth               | boolean                  | No          | No       | -              |

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
| related_id        | uuid                     | No          | No       | related       |

## Table: `messages`

| Column Name     | Data Type                | Primary Key | Nullable | Foreign Key To |
| --------------- | ------------------------ | ----------- | -------- | -------------- |
| id              | uuid                     | Yes         | No       | -              |
| conversation_id | uuid                     | No          | No       | conversations  |
| sender_id       | uuid                     | No          | No       | -              |
| content         | text                     | No          | No       | -              |
| read_at         | timestamp with time zone | No          | Yes      | -              |
| created_at      | timestamp with time zone | No          | No       | -              |

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
| related_type       | USER-DEFINED             | No          | Yes      | -              |

## Table: `people`

| Column Name        | Data Type                | Primary Key | Nullable | Foreign Key To |
| ------------------ | ------------------------ | ----------- | -------- | -------------- |
| id                 | uuid                     | Yes         | No       | -              |
| name               | text                     | No          | No       | -              |
| email              | text                     | No          | Yes      | -              |
| phone              | text                     | No          | Yes      | -              |
| title              | text                     | No          | Yes      | -              |
| known_as           | text                     | No          | Yes      | -              |
| company_name       | text                     | No          | Yes      | -              |
| company_id         | uuid                     | No          | Yes      | companies      |
| contact_type       | text                     | No          | Yes      | -              |
| source             | text                     | No          | Yes      | -              |
| referral_source    | text                     | No          | Yes      | -              |
| assigned_to        | uuid                     | No          | Yes      | users          |
| about              | text                     | No          | Yes      | -              |
| notes              | text                     | No          | Yes      | -              |
| description        | text                     | No          | Yes      | -              |
| history            | text                     | No          | Yes      | -              |
| tags               | ARRAY                    | No          | Yes      | -              |
| linkedin           | text                     | No          | Yes      | -              |
| twitter            | text                     | No          | Yes      | -              |
| website            | text                     | No          | Yes      | -              |
| work_website       | text                     | No          | Yes      | -              |
| last_activity_at   | timestamp with time zone | No          | Yes      | -              |
| last_contacted     | timestamp with time zone | No          | Yes      | -              |
| created_at         | timestamp with time zone | No          | No       | -              |
| updated_at         | timestamp with time zone | No          | No       | -              |
| copper_person_id   | text                     | No          | Yes      | -              |
| source_system      | text                     | No          | No       | -              |
| clx_file_name      | text                     | No          | Yes      | -              |
| bank_relationships | text                     | No          | Yes      | -              |
| related_id          | uuid                     | No          | No       | related       |

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

## Table: `project_people`

| Column Name | Data Type                | Primary Key | Nullable | Foreign Key To  |
| ----------- | ------------------------ | ----------- | -------- | --------------- |
| id          | uuid                     | Yes         | No       | -               |
| project_id  | uuid                     | No          | No       | related_projects |
| lead_id     | uuid                     | No          | No       | -               |
| role        | text                     | No          | Yes      | -               |
| created_at  | timestamp with time zone | No          | No       | -               |
| related_type | USER-DEFINED             | No          | Yes      | -               |

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
| lead_id               | uuid                     | No          | No       | deals          |
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
| related_type           | USER-DEFINED             | No          | Yes      | -              |

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
| related_type           | USER-DEFINED             | No          | Yes      | -              |

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

## Table: `task_activities`

| Column Name     | Data Type                | Primary Key | Nullable | Foreign Key To |
| --------------- | ------------------------ | ----------- | -------- | -------------- |
| id              | uuid                     | Yes         | No       | -              |
| task_id         | uuid                     | No          | No       | tasks          |
| activity_type   | text                     | No          | No       | -              |
| content         | text                     | No          | Yes      | -              |
| old_value       | text                     | No          | Yes      | -              |
| new_value       | text                     | No          | Yes      | -              |
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
| lead_id         | uuid                     | No          | Yes      | deals          |
| source          | text                     | No          | Yes      | -              |
| task_type       | text                     | No          | Yes      | -              |
| user_id         | uuid                     | No          | Yes      | users          |
| completed_at    | timestamp with time zone | No          | Yes      | -              |
| created_by      | uuid                     | No          | Yes      | users          |
| related_type     | USER-DEFINED             | No          | Yes      | -              |
| copper_task_id  | text                     | No          | Yes      | -              |
| source_system   | text                     | No          | No       | -              |
| related_id       | uuid                     | No          | Yes      | -              |

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
| created_by     | uuid                     | No          | Yes      | users          |
| created_at     | timestamp with time zone | No          | Yes      | -              |
| updated_at     | timestamp with time zone | No          | Yes      | -              |

