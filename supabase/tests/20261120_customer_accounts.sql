-- Full transaction rollback. Never persist test changes.
begin;
select set_config('request.jwt.claim.sub',(
 select ur.user_id::text from public.user_roles ur join public.roles r on r.id=ur.role_id
 where r.code='admin' limit 1),true);
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('qa.order_id',(
 select o.id::text from public.orders o
 where not exists(select 1 from public.customer_order_claims c where c.order_id=o.id)
 and not exists(select 1 from public.customer_order_links l where l.order_id=o.id)
 limit 1),true);
insert into public.customer_order_claims(order_id,token_hash,expires_at)
values(current_setting('qa.order_id')::uuid,encode(sha256(convert_to('qa-lcb-customer-order-claim-20261120-token','UTF8')),'hex'),now()+interval '1 hour');
set local role authenticated;
do $qa$
declare uid uuid:=auth.uid(); order_uuid uuid; token text:='qa-lcb-customer-order-claim-20261120-token'; result jsonb;
begin
 if uid is null then raise exception 'Missing DEV admin fixture'; end if;
 perform public.my_customer_account();
 perform public.save_my_customer_account('QA Admin','3794111222','Dirección de prueba');
 if not exists(select 1 from public.customer_accounts where user_id=uid and full_name='QA Admin')
 then raise exception 'Self-service profile was not saved'; end if;
 order_uuid:=current_setting('qa.order_id')::uuid;
 if public.claim_my_customer_order('invalid-invalid-invalid-invalid-invalid') then
 raise exception 'Invalid claim was accepted'; end if;
 if not public.claim_my_customer_order(token) then raise exception 'Valid claim was not accepted';end if;
 if public.claim_my_customer_order(token) then raise exception 'Replay claim was accepted';end if;
 if not exists(select 1 from public.customer_order_links where order_id=order_uuid and user_id=uid)
 then raise exception 'Order ownership not persisted';end if;
 result:=public.my_customer_orders();
 if not exists(select 1 from jsonb_array_elements(result) x where x->>'id'=order_uuid::text)
 then raise exception 'Owned order missing from history';end if;
 if exists(select 1 from public.customer_order_links where user_id<>uid and order_id=order_uuid)
 then raise exception 'Order was linked to another account';end if;
 perform public.admin_customer_directory();
end $qa$;
rollback;

begin;
select set_config('request.jwt.claim.sub',(
 select ur.user_id::text from public.user_roles ur
 where not exists(select 1 from public.user_roles x join public.roles r on r.id=x.role_id
 where x.user_id=ur.user_id and r.code='admin') limit 1),true);
select set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;
do $security$
declare blocked boolean:=false;
begin
 if auth.uid() is null then raise exception 'Missing non-admin DEV fixture'; end if;
 begin perform public.admin_customer_directory();exception when others then blocked:=true;end;
 if not blocked then raise exception 'Non-admin accessed customer directory';end if;
 blocked:=false;
 begin perform public.admin_create_customer('QA Guest','3794000000','');exception when others then blocked:=true;end;
 if not blocked then raise exception 'Non-admin created commercial customer';end if;
 blocked:=false;
 begin perform public.admin_update_customer_directory('registered',auth.uid(),'QA','3794000000','');
 exception when others then blocked:=true;end;
 if not blocked then raise exception 'Non-admin updated customer data';end if;
end $security$;
rollback;
