import router from '@adonisjs/core/services/router'

const TerritorioController = () => import('#modules/territorio/controllers/territorio_controller')

export function registerTerritorioRoutes() {
  router.get('area-estudo', [TerritorioController, 'areaEstudo'])
  router.get('grelha', [TerritorioController, 'grelha'])
  router
    .get('grelha/tiles/:z/:x/:y', [TerritorioController, 'tile'])
    .where('z', /^\d+$/)
    .where('x', /^\d+$/)
    .where('y', /^\d+$/)
}
