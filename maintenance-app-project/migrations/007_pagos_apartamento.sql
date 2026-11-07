-- Pagos de administración: número de factura (opcional) y apartamento al que corresponde el pago.
-- El tipo de apartamento no se guarda aquí: se lee de apartamentos_casas.tipo.
ALTER TABLE pagos
  ADD COLUMN `numero_factura` varchar(120) DEFAULT NULL AFTER `monto`,
  ADD COLUMN `apartamento_id` int DEFAULT NULL AFTER `usuario_id`,
  ADD KEY `idx_pagos_apartamento_id` (`apartamento_id`),
  ADD CONSTRAINT `fk_pagos_apartamento` FOREIGN KEY (`apartamento_id`) REFERENCES `apartamentos_casas` (`id`);
