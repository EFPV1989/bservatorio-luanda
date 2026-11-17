import router from '@adonisjs/core/services/router'

const CamadasController = () => import('#modules/camadas/controllers/camadas_controller')

export function registerCamadasRoutes() {
  router.get('camadas', [CamadasController, 'index'])
  router.get('camadas/:id/serie', [CamadasController, 'serie'])
  router.get('camadas/:id/hexagonos/:hexagonoId', [CamadasController, 'hexagono'])
}
