/*
 * Licensed to the Apache Software Foundation (ASF) under one or more
 * contributor license agreements.  See the NOTICE file distributed with
 * this work for additional information regarding copyright ownership.
 * The ASF licenses this file to You under the Apache License, Version 2.0
 * (the "License"); you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { defineComponent, inject, computed } from 'vue'
import { NTooltip, NProgress } from 'naive-ui'
import styles from './index.module.scss'
import { ModernNodeData, determineNodeType } from './use-dag-node'
import { CanvasDesignTokens, getNodeStateColor, NodeType } from './design-tokens'
import { useI18n } from 'vue-i18n'

const Node = defineComponent({
  name: 'Node',
  setup() {
    const { t } = useI18n()
    const getNode = inject('getNode') as any
    
    if (!getNode) {
      console.error('getNode function not found in inject')
      return () => <div class={styles['dag-node']}>{t('project.synchronization_instance.error_message')}：节点数据不可用</div>
    }
    
    const node = getNode()
    const nodeData = node?.getData() || {} as ModernNodeData
    

    const {
      name = t('common.unknown'),
      nodeType,
      connectorType,
      status = 'idle',
      theme,
      isSelected = false,
      isHovered = false,
      isDragging = false,
      isDisabled = false,
      animations = {},
      style = {},
      progress = 0,
      statusMessage,
      metadata = {}
    } = nodeData
    

    const actualNodeType = computed(() => 
      determineNodeType(nodeType, connectorType, name)
    )
    

    const getNodeIcon = (type: NodeType) => {

      if (metadata.icon) {
        return metadata.icon
      }
      
      switch (type) {
        case 'source':
          return '📊'
        case 'sink':
          return '🎯'
        case 'transform':
          return '⚙️'
        default:
          return null
      }
    }
    

    const nodeClass = computed(() => {
      return {
        [styles['dag-node']]: true,
        [styles[`dag-node--${actualNodeType.value}`]]: true,
        [styles['dag-node--selected']]: isSelected,
        [styles['dag-node--hovered']]: isHovered,
        [styles['dag-node--dragging']]: isDragging,
        [styles['dag-node--disabled']]: isDisabled,
        [styles[`dag-node--${status}`]]: true,
        [styles['dag-node--entrance']]: animations.entrance,
        [styles['dag-node--pulse']]: animations.pulse,
        [styles['dag-node--glow']]: animations.glow,
        [styles['dag-node--shake']]: animations.shake
      }
    })
    

    const getBorderStyle = () => {

      if (theme) {
        if (status === 'error') {
          return `4px solid ${getNodeStateColor('error')}`
        } else if (status === 'warning') {
          return `4px solid ${getNodeStateColor('warning')}`
        } else {
          return `4px solid ${theme.borderColor}`
        }
      }
      

      if (status === 'error') {
        return '4px solid #F87171'
      } else if (status === 'warning') {
        return '4px solid #FBBF24'
      } else if (actualNodeType.value === 'source') {
        return '4px solid #34D399'
      } else if (actualNodeType.value === 'sink') {
        return '4px solid #60A5FA'
      } else if (actualNodeType.value === 'transform') {
        return '4px solid #A78BFA'
      } else {
        return '4px solid #60A5FA'
      }
    }


    const getBackgroundStyle = () => {

      if (theme) {
        if (status === 'error') {
          return 'linear-gradient(135deg, #FEF2F2 0%, #FEE2E2 100%)'
        } else if (status === 'warning') {
          return 'linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)'
        } else {
          return theme.gradient
        }
      }
      

      if (status === 'error') {
        return 'linear-gradient(135deg, #FEF2F2 0%, #FEE2E2 100%)'
      } else if (status === 'warning') {
        return 'linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)'
      } else if (actualNodeType.value === 'source') {
        return 'linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%)'
      } else if (actualNodeType.value === 'sink') {
        return 'linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)'
      } else if (actualNodeType.value === 'transform') {
        return 'linear-gradient(135deg, #F5F3FF 0%, #EDE9FE 100%)'
      } else {
        return 'linear-gradient(135deg, #F8FAFC 0%, #F1F5F9 100%)'
      }
    }
    

    const getShadowStyle = () => {
      if (isSelected) {
        return CanvasDesignTokens.shadows.nodeSelected
      } else if (isHovered) {
        return CanvasDesignTokens.shadows.nodeHover
      } else if (isDragging) {
        return CanvasDesignTokens.shadows.nodeActive
      } else {
        return style.shadow || CanvasDesignTokens.shadows.node
      }
    }
    

    const getStatusColor = () => {
      return getNodeStateColor(status)
    }
    

    const nodeStyle = computed(() => ({
      borderLeft: getBorderStyle(),
      background: getBackgroundStyle(),
      boxShadow: getShadowStyle(),
      borderRadius: style.borderRadius || CanvasDesignTokens.borderRadius.node,
      opacity: isDisabled ? 0.6 : (style.opacity || 1),
      width: style.width ? `${style.width}px` : 'auto',
      height: style.height ? `${style.height}px` : 'auto',
      zIndex: style.zIndex || CanvasDesignTokens.zIndex.nodes
    }))
    

    const getTextColor = () => {
      return theme?.textColor || '#374151'
    }
    
    return () => (
      <div
        class={nodeClass.value}
        style={nodeStyle.value}
      >
        {/* 节点图标 */}
        
        {/* 节点标签 */}
        <NTooltip trigger='hover' placement='top'>
          {{
            trigger: () => (
              <div class={styles['dag-node-label']} style={{ color: getTextColor() }}>
                <span>{name}</span>
              </div>
            ),
            default: () => (
              <div>
                <div><strong>{name}</strong></div>
                <div style={{ fontSize: '12px', opacity: 0.8 }}>
                  类型: {actualNodeType.value === 'source' ? '数据源' : actualNodeType.value === 'sink' ? '数据目标' : '数据转换'}
                </div>
                {status !== 'idle' && (
                  <div style={{ fontSize: '12px', opacity: 0.8 }}>
                    状态: {status === 'running' ? '运行中' : status === 'success' ? '成功' : status === 'error' ? '错误' : status === 'warning' ? '警告' : status}
                  </div>
                )}
                {statusMessage && (
                  <div style={{ fontSize: '12px', opacity: 0.8 }}>
                    信息: {statusMessage}
                  </div>
                )}
                {metadata.description && (
                  <div style={{ fontSize: '12px', opacity: 0.8 }}>
                    描述: {metadata.description}
                  </div>
                )}
                {metadata.tags && metadata.tags.length > 0 && (
                  <div style={{ fontSize: '12px', opacity: 0.8 }}>
                    标签: {metadata.tags.join(', ')}
                  </div>
                )}
              </div>
            )
          }}
        </NTooltip>
        
        {/* 状态指示器 */}
        
        {/* 进度条 - 仅在运行状态显示 */}
        {status === 'running' && progress > 0 && (
          <div class={styles['dag-node-progress']}>
            <NProgress 
              type="line" 
              percentage={progress} 
              height={4}
              color={getNodeStateColor('running')}
              railColor="rgba(100, 116, 139, 0.2)"
            />
          </div>
        )}
        
        {/* 发光效果 - 用于成功状态 */}
        {animations.glow && (
          <div class={styles['dag-node-glow']} />
        )}
        
        {/* 不再使用自定义连接点，改用X6原生连接点 */}
      </div>
    )
  }
})

export default Node
