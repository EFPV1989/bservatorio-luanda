/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| API pública, só de leitura, versionada em /api/v1. Cada módulo regista as
| suas rotas.
|
*/

import router from '@adonisjs/core/services/router'
import { registerTerritorioRoutes } from '#modules/territorio/routes'
import { registerCamadasRoutes } from '#modules/camadas/routes'

const HealthController = () => import('#shared/controllers/health_controller')

router
  .group(() => {
    router.get('health', [HealthController, 'live'])
    router.get('health/ready', [HealthController, 'ready'])

    registerTerritorioRoutes()
    registerCamadasRoutes()
  })
  .prefix('/api/v1')
