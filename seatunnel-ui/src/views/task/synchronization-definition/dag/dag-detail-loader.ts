/*
 * @author: zhjj
 */

type ValidationResult = {
  pluginId: string
  name: string
  databases: string[]
  tables: string[]
}

type SourceValidationIssue = ValidationResult

type LoaderServices = {
  getDefinitionNodesAndEdges: (jobCode: string) => Promise<any>
  getDefinitionConfig: (jobCode: string) => Promise<any>
  getDefinitionDetail: (jobCode: string) => Promise<any>
  checkDatabaseAndTable: (
    datasourceId: string,
    data: { databases: string[]; tables: string[] }
  ) => Promise<{ databases?: string[]; tables?: string[] }>
}

type LoaderParams = {
  jobDefinitionCode: string
  t: (key: string) => string
  message?: {
    warning?: (content: string, options?: Record<string, any>) => void
  }
  setDagInfo: (dagInfo: Record<string, any>) => void
  services: LoaderServices
}

const isValidTableOption = (tableOption: any) =>
  tableOption &&
  Array.isArray(tableOption.databases) &&
  Array.isArray(tableOption.tables)

const canValidateSourcePlugin = (plugin: any) =>
  plugin?.type === 'SOURCE' &&
  plugin?.dataSourceId !== undefined &&
  plugin?.dataSourceId !== null &&
  isValidTableOption(plugin?.tableOption)

const mergeOptionalDagInfo = (config: any, detail: any) => ({
  ...(config || {}),
  ...(detail || {})
})

async function loadDagInfo(
  jobDefinitionCode: string,
  services: LoaderServices
) {
  const [configResult, detailResult] = await Promise.allSettled([
    services.getDefinitionConfig(jobDefinitionCode),
    services.getDefinitionDetail(jobDefinitionCode)
  ])

  return mergeOptionalDagInfo(
    configResult.status === 'fulfilled' ? configResult.value : null,
    detailResult.status === 'fulfilled' ? detailResult.value : null
  )
}

async function validateSourcePlugins(
  plugins: any[],
  services: LoaderServices
): Promise<Map<string, ValidationResult>> {
  const results = await Promise.all(
    plugins.map(async (plugin) => {
      if (!canValidateSourcePlugin(plugin)) {
        return null
      }

      try {
        const result = await services.checkDatabaseAndTable(
          String(plugin.dataSourceId),
          plugin.tableOption
        )

        return {
          pluginId: plugin.pluginId,
          name: plugin.name,
          databases: result?.databases || [],
          tables: result?.tables || []
        }
      } catch (error) {
        console.warn(
          `[synchronization-definition] source validation failed for ${plugin.pluginId}, keeping original dag node data`,
          error
        )
        return null
      }
    })
  )

  return new Map(
    results
      .filter((result): result is ValidationResult => Boolean(result?.pluginId))
      .map((result) => [result.pluginId, result])
  )
}

function applyValidationResult(plugin: any, validationResult?: ValidationResult) {
  if (!validationResult || !isValidTableOption(plugin?.tableOption)) {
    return plugin
  }

  const invalidDatabases = new Set(validationResult.databases)
  const invalidTables = new Set(validationResult.tables)

  return {
    ...plugin,
    tableOption: {
      ...plugin.tableOption,
      databases: plugin.tableOption.databases.filter(
        (database: string) => !invalidDatabases.has(database)
      ),
      tables: plugin.tableOption.tables.filter(
        (table: string) => !invalidTables.has(table)
      )
    }
  }
}

export async function loadDagDetailData({
  jobDefinitionCode,
  setDagInfo,
  services
}: LoaderParams) {
  const [nodesAndEdges, dagInfo] = await Promise.all([
    services.getDefinitionNodesAndEdges(jobDefinitionCode),
    loadDagInfo(jobDefinitionCode, services)
  ])

  setDagInfo(dagInfo)

  if (!nodesAndEdges?.plugins?.length) {
    return { nodesAndEdges }
  }

  const validationResults = await validateSourcePlugins(
    nodesAndEdges.plugins,
    services
  )
  const sourceValidationIssues = nodesAndEdges.plugins
    .map((plugin: any) => validationResults.get(plugin.pluginId))
    .filter(
      (validationResult): validationResult is SourceValidationIssue =>
        Boolean(
          validationResult &&
            (validationResult.databases.length > 0 ||
              validationResult.tables.length > 0)
        )
    )

  return {
    nodesAndEdges: {
      ...nodesAndEdges,
      plugins: nodesAndEdges.plugins.map((plugin: any) =>
        applyValidationResult(plugin, validationResults.get(plugin.pluginId))
      )
    },
    sourceValidationIssues
  }
}
