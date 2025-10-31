import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Layers, Eye, EyeOff, Satellite, Map, Mountain } from 'lucide-react';
import { toggleLayer, setLayerOpacity } from '../../store/slices/mapSlice';

const LayerSelector = () => {
  const dispatch = useDispatch();
  const { layers, selectedLayers } = useSelector((state) => state.map);
  const [isExpanded, setIsExpanded] = useState(false);

  const getLayerIcon = (layerType) => {
    switch (layerType) {
      case 'basemap':
        return <Map className="w-4 h-4" />;
      case 'imagery':
        return <Satellite className="w-4 h-4" />;
      case 'watershed':
        return <Mountain className="w-4 h-4" />;
      case 'detection':
        return <Layers className="w-4 h-4" />;
      default:
        return <Layers className="w-4 h-4" />;
    }
  };

  const handleLayerToggle = (layerId) => {
    dispatch(toggleLayer({ layerId }));
  };

  const handleOpacityChange = (layerId, opacity) => {
    dispatch(setLayerOpacity({ layerId, opacity }));
  };

  return (
    <div className="absolute top-4 right-4 z-[1000] bg-white rounded-lg shadow-lg border border-gray-200">
      <div className="p-2 border-b border-gray-200">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 text-gray-700 hover:text-gray-900 transition-colors"
        >
          <Layers className="w-5 h-5" />
          <span className="font-medium">Layers</span>
          <span className="text-xs bg-gray-100 px-2 py-1 rounded">
            {selectedLayers.length}
          </span>
        </button>
      </div>

      {isExpanded && (
        <div className="p-3 max-h-80 overflow-y-auto min-w-72">
          <div className="space-y-3">
            {layers.map((layer) => (
              <div key={layer.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="text-gray-500">
                      {getLayerIcon(layer.type)}
                    </div>
                    <div>
                      <div className="font-medium text-sm text-gray-900">
                        {layer.name}
                      </div>
                      {layer.description && (
                        <div className="text-xs text-gray-500">
                          {layer.description}
                        </div>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleLayerToggle(layer.id)}
                    className={`p-1 rounded transition-colors ${
                      layer.visible
                        ? 'text-blue-600 hover:text-blue-700'
                        : 'text-gray-400 hover:text-gray-600'
                    }`}
                  >
                    {layer.visible ? (
                      <Eye className="w-4 h-4" />
                    ) : (
                      <EyeOff className="w-4 h-4" />
                    )}
                  </button>
                </div>

                {layer.visible && (
                  <div className="space-y-1 ml-6">
                    {/* Opacity slider */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 w-12">Opacity</span>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={layer.opacity || 1}
                        onChange={(e) =>
                          handleOpacityChange(layer.id, parseFloat(e.target.value))
                        }
                        className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                      />
                      <span className="text-xs text-gray-500 w-8">
                        {Math.round((layer.opacity || 1) * 100)}%
                      </span>
                    </div>

                    {/* Layer-specific controls */}
                    {layer.type === 'imagery' && layer.bands && (
                      <div className="text-xs text-gray-500">
                        Bands: {layer.bands.join(', ')}
                      </div>
                    )}

                    {layer.type === 'detection' && layer.confidence && (
                      <div className="text-xs text-gray-500">
                        Confidence: {Math.round(layer.confidence * 100)}%
                      </div>
                    )}

                    {layer.data && (
                      <div className="text-xs text-gray-500">
                        Features: {layer.data.length || 0}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Add Layer Button */}
          <div className="pt-3 mt-3 border-t border-gray-200">
            <button className="w-full text-left px-3 py-2 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors">
              + Add Custom Layer
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default LayerSelector;