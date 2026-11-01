-- =====================================================================
-- Triggers oficiales de ArucaSync
-- Calculan precios, impuestos, costos y totales dentro de PostgreSQL.
-- Se aplican sobre las tablas del A2; no cambian su estructura.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Detalle: precios, impuesto y costos desde arc_inv_costos_precios
-- ---------------------------------------------------------------------
create or replace function fn_dtv_calcular_precios()
returns trigger
language plpgsql
as $$
declare
  v_tipoprecio int;
  v_moneda int;
  v_factor numeric;
  v_lista int;
  v_col text;
  v_precio numeric;
  v_impuesto numeric := 16;
  v_costo_bs numeric;
  v_costo_ext numeric;
begin
  select coalesce(trn_tipoprecio, 0),
         coalesce(trn_moneda, 2),
         coalesce(trn_factorcambio, 1)
    into v_tipoprecio, v_moneda, v_factor
    from arc_transacciones
   where trn_autoincrement = new.dtv_operacion_autoincrement
     and trn_documento = new.dtv_documento;

  if not found then
    return new;
  end if;

  -- trn_tipoprecio: 0 -> lista 1, 1 -> lista 2, 2 -> lista 3, 3 -> lista 4
  v_lista := least(6, greatest(1, v_tipoprecio + 1));
  v_col := 'icp_p' || lpad(v_lista::text, 2, '0') ||
           case when v_moneda = 2 then 'preciototalext' else 'preciosinimpuesto' end;

  execute format(
    'select %I, icp_costoactbolivares, icp_costoactextranjero, coalesce(icp_imp01monto, 16)
       from arc_inv_costos_precios
      where icp_codeitem = $1',
    v_col
  )
  into v_precio, v_costo_bs, v_costo_ext, v_impuesto
  using new.dtv_codigo;

  if v_precio is null then
    return new;
  end if;

  new.dtv_preciosindescuento := round(v_precio::numeric, 4);
  new.dtv_preciocondescuento := round(
    (v_precio * (1 - coalesce(new.dtv_porcentdescuento1, 0) / 100.0))::numeric, 4
  );
  new.dtv_impuesto1 := v_impuesto;
  new.dtv_porcentimpuesto1 := true;
  new.dtv_montoimpuesto1 := round(
    (new.dtv_preciocondescuento * v_impuesto / 100.0)::numeric, 4
  );
  new.dtv_preciodeventa := round(
    (new.dtv_preciocondescuento + new.dtv_montoimpuesto1)::numeric, 4
  );
  new.dtv_preciobasecomision := new.dtv_preciocondescuento;

  new.dtv_costoactualnacional := coalesce(v_costo_bs, 0);
  new.dtv_costoactualext := coalesce(v_costo_ext, 0);
  new.dtv_costo := case
    when coalesce(v_factor, 0) > 0 and coalesce(v_costo_bs, 0) > 0
      then round((v_costo_bs / v_factor)::numeric, 4)::double precision
    else coalesce(v_costo_ext, 0)
  end;
  new.dtv_costooperacion := new.dtv_costo;
  new.dtv_costodeventas := new.dtv_costo;

  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Cabecera: totales oficiales cada vez que cambia un detalle
-- ---------------------------------------------------------------------
create or replace function fn_dtv_recalcular_cabecera()
returns trigger
language plpgsql
as $$
declare
  v_auto bigint;
  v_doc varchar;
begin
  if tg_op = 'DELETE' then
    v_auto := old.dtv_operacion_autoincrement;
    v_doc := old.dtv_documento;
  else
    v_auto := new.dtv_operacion_autoincrement;
    v_doc := new.dtv_documento;
  end if;

  update arc_transacciones t
     set trn_totalitems = x.items,
         trn_totalitemsinicial = x.items,
         trn_totalbruto = round(x.bruto::numeric, 2),
         trn_descuento1monto = round(x.descuento::numeric, 2),
         trn_baseimponible = round(x.base::numeric, 2),
         trn_impuesto1monto = round(x.impuesto::numeric, 2),
         trn_totalneto = round(x.total::numeric, 2),
         trn_totalprecio = round(x.base::numeric, 2),
         trn_saldooperacion = round(x.total::numeric, 2),
         -- El A2 real guarda en trn_totalcosto el bruto de la venta.
         trn_totalcosto = round(x.bruto::numeric, 2),
         trn_totalcostoreal = round(x.costoreal::numeric, 4),
         trn_costodeventa = round(x.costoreal::numeric, 4),
         trn_costoactualex = round(x.costoext::numeric, 2),
         trn_costoactualnacional = round(x.costonacional::numeric, 2),
         trn_impuesto1porcent = 16,
         trn_lastupdatedate = now()
    from (
      select count(*) as items,
             coalesce(sum(dtv_preciosindescuento * dtv_cantidad), 0) as bruto,
             coalesce(sum((dtv_preciosindescuento - dtv_preciocondescuento) * dtv_cantidad), 0) as descuento,
             coalesce(sum(dtv_preciocondescuento * dtv_cantidad), 0) as base,
             coalesce(sum(dtv_montoimpuesto1 * dtv_cantidad), 0) as impuesto,
             coalesce(sum(dtv_preciodeventa * dtv_cantidad), 0) as total,
             coalesce(sum(dtv_costo * dtv_cantidad), 0) as costoreal,
             coalesce(sum(dtv_costoactualext * dtv_cantidad), 0) as costoext,
             coalesce(sum(dtv_costoactualnacional * dtv_cantidad), 0) as costonacional
        from arc_detalletranvtas
       where dtv_operacion_autoincrement = v_auto
         and dtv_documento = v_doc
    ) x
   where t.trn_autoincrement = v_auto
     and t.trn_documento = v_doc;

  return null;
end;
$$;

-- ---------------------------------------------------------------------
-- Sincronización: todo pedido nuevo nace pendiente (false)
-- ---------------------------------------------------------------------
create or replace function fn_trn_sync_false()
returns trigger
language plpgsql
as $$
begin
  new.trn_sync_status := false;
  return new;
end;
$$;

-- Desactivar triggers antiguos/duplicados que calculan precios en bolívares
-- y sobrescriben los precios en dólares.
drop trigger if exists trg_dtv_calcular_totales on arc_detalletranvtas;
drop trigger if exists trg_actualizar_totales_cabecera on arc_detalletranvtas;

drop trigger if exists trg_dtv_calcular_precios on arc_detalletranvtas;
create trigger trg_dtv_calcular_precios
before insert or update on arc_detalletranvtas
for each row execute function fn_dtv_calcular_precios();

drop trigger if exists trg_dtv_recalcular_cabecera on arc_detalletranvtas;
create trigger trg_dtv_recalcular_cabecera
after insert or update or delete on arc_detalletranvtas
for each row execute function fn_dtv_recalcular_cabecera();

drop trigger if exists trg_trn_sync_status on arc_transacciones;
create trigger trg_trn_sync_status
before insert on arc_transacciones
for each row execute function fn_trn_sync_false();
