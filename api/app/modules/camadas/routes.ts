import router from '@adonisjs/core/services/router'

const CamadasController = () => import('#modules/camadas/controllers/camadas_controller')

export function registerCamadasRoutes() {
  router.get('camadas', [CamadasController, 'index'])
}
