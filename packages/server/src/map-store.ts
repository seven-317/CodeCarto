import fs from 'node:fs'
import path from 'node:path'
import {
  cartoMapFileSchema,
  emptyMapFile,
  serializeMapFile,
  type CartoMapFile,
} from '@codecarto/shared'

export const MAP_FILE_NAME = 'codecarto.map.json'

/** codecarto.map.json 的讀寫;寫入走 temp 檔 + rename 確保原子性 */
export class MapStore {
  readonly filePath: string

  constructor(projectRoot: string) {
    this.filePath = path.join(projectRoot, MAP_FILE_NAME)
  }

  read(): CartoMapFile {
    if (!fs.existsSync(this.filePath)) return emptyMapFile()
    const raw = fs.readFileSync(this.filePath, 'utf8')
    return cartoMapFileSchema.parse(JSON.parse(raw))
  }

  write(map: CartoMapFile): void {
    const validated = cartoMapFileSchema.parse(map)
    const tmp = `${this.filePath}.tmp-${process.pid}`
    fs.writeFileSync(tmp, serializeMapFile(validated))
    fs.renameSync(tmp, this.filePath)
  }
}
