import React, { useEffect, useState } from 'react';
import { 
  GitBranch, 
  GitCommit, 
  Clock, 
  ChevronRight,
  ChevronDown,
  Tag,
  MoreVertical,
  ArrowUpRight,
  GitMerge,
  Trash2
} from 'lucide-react';
import { getVersionManager, Version, VersionTree as VT } from '../lib/version-manager';
import { useToast } from '../hooks/useToast';

interface VersionNodeProps {
  version: Version;
  tree: VT;
  depth: number;
  onVersionClick: (versionId: string) => void;
  currentVersionId: string;
}

const VersionNode: React.FC<VersionNodeProps> = ({ 
  version, 
  tree, 
  depth, 
  onVersionClick,
  currentVersionId 
}) => {
  const [expanded, setExpanded] = useState(true);
  const [showMenu, setShowMenu] = useState(false);
  const toast = useToast();
  
  const isCurrentVersion = version.id === currentVersionId;
  const hasChildren = version.children.length > 0;
  const isBranch = !version.isMainBranch && version.parentId !== 'root';
  
  const handleBranch = async () => {
    try {
      const versionManager = getVersionManager();
      await versionManager.createBranch(
        version.id,
        `Rama desde ${version.name}`,
        'Nueva línea de desarrollo'
      );
      toast.success('Rama creada exitosamente');
    } catch (error) {
      toast.error('Error al crear rama');
    }
  };
  
  return (
    <div className="relative">
      {/* Línea conectora */}
      {depth > 0 && (
        <div 
          className="absolute left-0 top-0 w-px bg-gray-300"
          style={{ 
            left: `${depth * 24 - 12}px`,
            height: '100%'
          }}
        />
      )}
      
      {/* Nodo de versión */}
      <div 
        className={`relative flex items-center space-x-2 p-2 rounded-lg transition-all cursor-pointer ${
          isCurrentVersion 
            ? 'bg-purple-100 border border-purple-300' 
            : 'hover:bg-gray-50'
        }`}
        style={{ marginLeft: `${depth * 24}px` }}
        onClick={() => onVersionClick(version.id)}
      >
        {/* Botón expandir/colapsar */}
        {hasChildren && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            className="p-0.5 hover:bg-gray-200 rounded"
          >
            {expanded ? (
              <ChevronDown className="h-3 w-3 text-gray-500" />
            ) : (
              <ChevronRight className="h-3 w-3 text-gray-500" />
            )}
          </button>
        )}
        
        {/* Icono de tipo */}
        <div className={`p-1 rounded ${
          version.id === 'root' 
            ? 'bg-green-100' 
            : isBranch 
              ? 'bg-yellow-100' 
              : 'bg-blue-100'
        }`}>
          {version.id === 'root' ? (
            <GitCommit className="h-3 w-3 text-green-600" />
          ) : isBranch ? (
            <GitBranch className="h-3 w-3 text-yellow-600" />
          ) : (
            <GitCommit className="h-3 w-3 text-blue-600" />
          )}
        </div>
        
        {/* Thumbnail si existe */}
        {version.thumbnail && (
          <img 
            src={version.thumbnail} 
            alt={version.name}
            className="w-8 h-8 rounded border border-gray-200 object-cover"
          />
        )}
        
        {/* Información de la versión */}
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium truncate ${
            isCurrentVersion ? 'text-purple-700' : 'text-gray-900'
          }`}>
            {version.name}
            {isCurrentVersion && (
              <span className="ml-2 text-xs bg-purple-200 px-1.5 py-0.5 rounded">
                Actual
              </span>
            )}
          </p>
          {version.description && (
            <p className="text-xs text-gray-500 truncate">
              {version.description}
            </p>
          )}
        </div>
        
        {/* Timestamp */}
        <div className="flex items-center text-xs text-gray-400">
          <Clock className="h-3 w-3 mr-1" />
          {new Date(version.timestamp).toLocaleTimeString()}
        </div>
        
        {/* Menú de opciones */}
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <MoreVertical className="h-3 w-3 text-gray-500" />
          </button>
          
          {showMenu && (
            <div className="absolute right-0 mt-1 w-36 bg-white rounded-lg shadow-lg border border-gray-200 z-20">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onVersionClick(version.id);
                  setShowMenu(false);
                }}
                className="w-full flex items-center space-x-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50"
              >
                <ArrowUpRight className="h-3 w-3" />
                <span>Cargar versión</span>
              </button>
              
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleBranch();
                  setShowMenu(false);
                }}
                className="w-full flex items-center space-x-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50"
              >
                <GitBranch className="h-3 w-3" />
                <span>Crear rama</span>
              </button>
              
              {version.tags.length > 0 && (
                <div className="px-3 py-2 text-xs text-gray-500">
                  <div className="flex flex-wrap gap-1">
                    {version.tags.map((tag, i) => (
                      <span key={i} className="bg-gray-100 px-1 py-0.5 rounded">
                        <Tag className="h-2 w-2 inline mr-0.5" />
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* Hijos recursivos */}
      {expanded && hasChildren && (
        <div className="relative">
          {version.children.map(childId => {
            const childVersion = tree.versions.get(childId);
            if (!childVersion) return null;
            
            return (
              <VersionNode
                key={childId}
                version={childVersion}
                tree={tree}
                depth={depth + 1}
                onVersionClick={onVersionClick}
                currentVersionId={currentVersionId}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

export const VersionTreeComponent: React.FC = () => {
  const [versionTree, setVersionTree] = useState<VT | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const toast = useToast();
  
  useEffect(() => {
    const versionManager = getVersionManager();
    
    // Obtener árbol inicial
    setVersionTree(versionManager.getVersionTree());
    
    // Suscribirse a cambios
    versionManager.onVersionUpdate((tree) => {
      setVersionTree(tree);
    });
    
    versionManager.onVersionCreate((version) => {
      toast.success(`Nueva versión: ${version.name}`);
    });
  }, []);
  
  const handleVersionClick = async (versionId: string) => {
    try {
      const versionManager = getVersionManager();
      await versionManager.switchToVersion(versionId);
      toast.info('Versión cargada');
    } catch (error) {
      toast.error('Error al cargar versión');
    }
  };
  
  if (!versionTree) return null;
  
  const stats = {
    total: versionTree.versions.size,
    branches: Array.from(versionTree.versions.values()).filter(v => !v.isMainBranch).length
  };
  
  return (
    <div className="bg-white border rounded-lg shadow-sm">
      {/* Header */}
      <div className="px-4 py-3 border-b flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <GitBranch className="h-4 w-4 text-purple-600" />
          <h3 className="text-sm font-semibold text-gray-900">
            Árbol de Versiones
          </h3>
        </div>
        
        <div className="flex items-center space-x-3">
          <div className="text-xs text-gray-500">
            <span className="font-medium">{stats.total}</span> versiones
            {stats.branches > 0 && (
              <span className="ml-2">
                <span className="font-medium">{stats.branches}</span> ramas
              </span>
            )}
          </div>
          
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1 hover:bg-gray-100 rounded"
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4 text-gray-500" />
            ) : (
              <ChevronDown className="h-4 w-4 text-gray-500" />
            )}
          </button>
        </div>
      </div>
      
      {/* Tree */}
      {!collapsed && (
        <div className="p-4 max-h-96 overflow-y-auto">
          <VersionNode
            version={versionTree.root}
            tree={versionTree}
            depth={0}
            onVersionClick={handleVersionClick}
            currentVersionId={versionTree.currentVersionId}
          />
        </div>
      )}
    </div>
  );
};

export default VersionTreeComponent;