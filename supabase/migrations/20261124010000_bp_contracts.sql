-- Weekly Contract ladder: contract runs are normal missions tagged with their week and score.
alter table bp_missions add column if not exists contract_week text;
alter table bp_missions add column if not exists score int;
create index if not exists bp_missions_contract on bp_missions (contract_week, score desc) where contract_week is not null;
