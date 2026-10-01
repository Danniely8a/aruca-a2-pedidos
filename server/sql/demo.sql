-- =====================================================================
-- Vaciado de prueba de la plataforma (NO del A2 real).
-- Se ejecuta con:  npm run seed:demo
-- Solo inserta si las tablas están vacías.
-- Los IDs son IDENTITY (GENERATED ALWAYS) => no se indican en el insert.
-- =====================================================================

-- Empresa ---------------------------------------------------------------
insert into arc_company (emp_codigo, emp_descripcion, emp_status, emp_fechacreacion, emp_fechasistema)
select 'ARUCA', 'ARUCA Maquinaria para Madera', true, now(), now()
where not exists (select 1 from arc_company);

-- Depósito ---------------------------------------------------------------
insert into arc_depositos (dep_codigo, dep_descripcion, dep_status, dep_systemdate)
select '01', 'Depósito principal', true, now()
where not exists (select 1 from arc_depositos);

-- Zonas / ciudades -------------------------------------------------------
insert into arc_zonas (zna_codigo, zna_descripcion, zna_status, zna_tipo, zna_systemdate)
select v.zna_codigo, v.zna_descripcion, true, 1, now()
  from (values
  ('Caracas',      'Caracas'),
  ('Valencia',     'Valencia'),
  ('Maracaibo',    'Maracaibo'),
  ('Barquisimeto', 'Barquisimeto'),
  ('Maracay',      'Maracay')
) as v(zna_codigo, zna_descripcion)
where not exists (select 1 from arc_zonas);

-- Categorías -------------------------------------------------------------
insert into arc_categorias (cat_codigo, cat_descripcion, cat_status, cat_systemdate)
select v.cat_codigo, v.cat_descripcion, true, now()
  from (values
  ('CAT-01', 'Máquinas'),
  ('CAT-02', 'Herramientas'),
  ('CAT-03', 'Repuestos'),
  ('CAT-04', 'Consumibles')
) as v(cat_codigo, cat_descripcion)
where not exists (select 1 from arc_categorias);

-- Productos --------------------------------------------------------------
insert into arc_inventario (inv_codigo, inv_descripcion, inv_categoria, inv_unidad, inv_status, inv_systemdate)
select v.inv_codigo, v.inv_descripcion, v.inv_categoria, 'unidad', true, now()
  from (values
  ('P-1001', 'Sierra de banco 18" 1.5 HP',        'CAT-01'),
  ('P-1002', 'Sierra caladora de banco',           'CAT-01'),
  ('P-1003', 'Fresadora de cantos 2.2 KW',         'CAT-01'),
  ('P-1004', 'Cortadora de madera 2600 W',         'CAT-01'),
  ('P-1005', 'Atornillador inalámbrico 20V',       'CAT-02'),
  ('P-1006', 'Taladro percutor 850 W',             'CAT-02'),
  ('P-1007', 'Amoladora angular 4.5"',             'CAT-02'),
  ('P-1008', 'Broca para madera 8 mm',             'CAT-02'),
  ('P-1009', 'Cinta de sierra 93.5"',              'CAT-03'),
  ('P-1010', 'Filo de planer 260 mm',              'CAT-03'),
  ('P-1011', 'Rodamiento 6204',                    'CAT-03'),
  ('P-1012', 'Correa trapezoidal SPZ-1250',        'CAT-03'),
  ('P-1013', 'Lijadora orbital 125 mm',            'CAT-02'),
  ('P-1014', 'Disco de corte 7" x 1.6 mm',         'CAT-04'),
  ('P-1015', 'Cera para pisos 1 L',                'CAT-04'),
  ('P-1016', 'Aceite lubricante 500 ml',           'CAT-04')
) as v(inv_codigo, inv_descripcion, inv_categoria)
where not exists (select 1 from arc_inventario);

-- Listas de precios (6 niveles; se llena p01 y p02, el resto se deja nulo)
insert into arc_inv_costos_precios (icp_codeitem, icp_p01preciosinimpuesto, icp_p01ipreciototal,
                                    icp_p02preciosinimpuesto, icp_p02ipreciototal, icp_usercreator, icp_systemdate)
select p.inv_codigo,
       v.p1, round(v.p1 * 1.16, 2),
       v.p1 * 0.92, round(v.p1 * 0.92 * 1.16, 2),
       'seed-demo', now()
  from arc_inventario p
  join (values
  ('P-1001', 12500.00), ('P-1002',  9800.00), ('P-1003', 21400.00), ('P-1004',  8700.00),
  ('P-1005',  1350.00), ('P-1006',  1980.00), ('P-1007',  1150.00), ('P-1008',    45.00),
  ('P-1009',  3200.00), ('P-1010',   480.00), ('P-1011',   120.00), ('P-1012',   210.00),
  ('P-1013',   890.00), ('P-1014',    95.00), ('P-1015',   350.00), ('P-1016',   140.00)
  ) as v(inv_codigo, p1) on v.inv_codigo = p.inv_codigo
 where not exists (select 1 from arc_inv_costos_precios);

-- Existencias ------------------------------------------------------------
insert into arc_existencia_actual (exa_tipo, exa_codigoproducto, exa_codigodeposito, exa_existencia, exa_status, exa_systemdate)
select 1, p.inv_codigo, 1,
       case when p.inv_id_auto % 4 = 0 then 0 else 10 + (p.inv_id_auto * 7) % 90 end,
       1, now()
  from arc_inventario p
 where not exists (select 1 from arc_existencia_actual);

-- Vendedores (tabla del A2; el código coincide con arc_users) -----------
insert into arc_vendedores (vnd_codigo, vnd_descripcion, vnd_status, vnd_email, vnd_tieneprecio, vnd_tieneventa, vnd_systemdate)
select v.vnd_codigo, v.vnd_descripcion, true, v.vnd_email, true, true, now()
  from (values
  ('V01', 'Administrador',   'admin@empresa.com'),
  ('V02', 'Carlos Vendedor', 'carlos@empresa.com'),
  ('V03', 'María Vendedora', 'maria@empresa.com')
) as v(vnd_codigo, vnd_descripcion, vnd_email)
where not exists (select 1 from arc_vendedores);

-- Usuarios ---------------------------------------------------------------
insert into arc_users (usr_codigo, usr_login, usr_descripcion, usr_rol, usr_status, usr_emailusuario, usr_emp_idauto, usr_fechacreacion, usr_fechasistema)
select v.usr_codigo, v.usr_login, v.usr_descripcion, v.usr_rol, true,
       v.usr_login as usr_emailusuario, (select emp_idauto from arc_company limit 1), now(), now()
  from (values
  ('V01', 'admin@empresa.com',  'Administrador',  'admin'),
  ('V02', 'carlos@empresa.com', 'Carlos Vendedor','vendedor'),
  ('V03', 'maria@empresa.com',  'María Vendedora','vendedor')
) as v(usr_codigo, usr_login, usr_descripcion, usr_rol)
where not exists (select 1 from arc_users);

-- Clientes (cli_preciodefecto = lista de precios, 1..6) ------------------
insert into arc_clientes (cli_codigo, cli_descripcion, cli_rif, cli_telefono, cli_zona, cli_direccion1,
                          cli_vendedor, cli_preciodefecto, cli_status, cli_systemdate)
select v.cli_codigo, v.cli_descripcion, v.cli_rif, v.cli_telefono,
       v.cli_zona, v.cli_direccion1, v.cli_vendedor, v.cli_preciodefecto, true, now()
  from (values
  ('C-0001', 'Almacén El Progreso',      'J-30123456-7', '0212-5550101', 'Caracas',     'Av. Bolívar, Urb. El Rosal',   'V02', 1),
  ('C-0002', 'Distribuidora La Fortuna', 'J-30987654-3', '0241-5550202', 'Valencia',    'Calle 50, Zona Industrial',    'V02', 2),
  ('C-0003', 'Supermercado Doña Rosa',   'J-29876543-1', '0212-5550303', 'Caracas',     'Av. Sucre, Coche',             'V03', 1),
  ('C-0004', 'Comercializadora Andes',   'J-27654321-9', '0261-5550404', 'Maracaibo',   'Av. 5 de Julio, Sector Norte', 'V03', 2),
  ('C-0005', 'Tienda El Ahorro',         'J-25432198-5', '0212-5550505', 'Barquisimeto','Calle 20 con Av. Libertador',  'V02', 1),
  ('C-0006', 'Mayorista El Triunfo',     'J-21345678-2', '0414-5550606', 'Maracay',     'Av. Bolívar, Choroní',         'V03', 2)
) as v(cli_codigo, cli_descripcion, cli_rif, cli_telefono, cli_zona, cli_direccion1, cli_vendedor, cli_preciodefecto)
where not exists (select 1 from arc_clientes);

-- Correlativo de pedidos -------------------------------------------------
insert into arc_correlatives (cor_modname, cor_proximo, cor_emp_codigo, cor_fechacreacion, cor_fechasistema, cor_usercreator, cor_namemachine)
select 'PEDIDO', 1, 'ARUCA', now(), now(), 'seed-demo', 'A2-WEB'
where not exists (select 1 from arc_correlatives where cor_modname = 'PEDIDO');
