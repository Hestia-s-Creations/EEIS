"""Raster data processing utilities using rasterio and xarray."""

import logging
import numpy as np
import xarray as xr
import rioxarray as rxr
import rasterio
from rasterio.transform import from_bounds
from rasterio.warp import reproject, Resampling
from rasterio.profiles import default_gtiff_profile
from typing import Dict, List, Tuple, Optional, Union
from pathlib import Path
from datetime import datetime
import warnings

from ..config import Settings


logger = logging.getLogger(__name__)


class RasterProcessor:
    """Main class for raster data processing operations."""
    
    def __init__(self, settings: Settings):
        self.settings = settings
        self.valid_data_flags = {
            'no_data': 0,
            'cloud': 1,
            'cloud_shadow': 2,
            'snow': 3,
            'water': 4,
            'vegetation': 5,
            'barren': 6,
            'building': 7
        }
    
    def read_satellite_image(self, 
                           image_path: Path,
                           bands: Optional[List[str]] = None) -> xr.Dataset:
        """Read satellite image with multiple bands into xarray dataset."""
        
        try:
            logger.info(f"Reading satellite image: {image_path}")
            
            # Use rioxarray to read the image
            ds = rxr.open_rasterio(image_path, chunks=True, decode_coords="all")
            
            # Handle different data dimensions
            if len(ds.dims) == 3:
                # Standard multi-band image (bands, y, x)
                if 'band' in ds.dims:
                    ds = ds.assign_coords(band=range(1, len(ds.band) + 1))
            elif len(ds.dims) == 2:
                # Single band image
                ds = ds.expand_dims('band')
                ds = ds.assign_coords(band=[1])
            
            # Apply scale factors if present (common for Landsat)
            if hasattr(ds, 'scale_factor') and ds.scale_factor != 1.0:
                ds = ds * ds.scale_factor
            if hasattr(ds, 'add_offset') and ds.add_offset != 0.0:
                ds = ds + ds.add_offset
            
            # Set coordinate names
            if 'x' in ds.coords and 'y' in ds.coords:
                ds = ds.rio.set_spatial_dims(x_dim='x', y_dim='y', inplace=True)
            
            logger.info(f"Successfully loaded image with shape: {ds.sizes}")
            return ds
            
        except Exception as e:
            logger.error(f"Error reading satellite image {image_path}: {e}")
            raise
    
    def read_geotiff(self, tiff_path: Path) -> xr.DataArray:
        """Read a single GeoTIFF file."""
        
        try:
            logger.info(f"Reading GeoTIFF: {tiff_path}")
            
            # Read with rioxarray
            data = rxr.open_rasterio(tiff_path, chunks=True, decode_coords="all")
            
            # Remove the band dimension if it's size 1
            if 'band' in data.dims and data.sizes['band'] == 1:
                data = data.squeeze('band')
            
            # Set spatial dimensions
            if 'x' in data.coords and 'y' in data.coords:
                data = data.rio.set_spatial_dims(x_dim='x', y_dim='y', inplace=True)
            
            logger.info(f"Successfully loaded GeoTIFF with shape: {data.sizes}")
            return data
            
        except Exception as e:
            logger.error(f"Error reading GeoTIFF {tiff_path}: {e}")
            raise
    
    def read_landsat_scene(self, scene_path: Path) -> xr.Dataset:
        """Read a complete Landsat scene from directory."""
        
        try:
            logger.info(f"Reading Landsat scene: {scene_path}")
            
            # Find band files
            band_files = {}
            for file_path in scene_path.glob("*.TIF"):
                band_name = file_path.stem.split('_')[-1]  # Extract band from filename
                band_files[band_name] = file_path
            
            if not band_files:
                raise ValueError(f"No TIF files found in {scene_path}")
            
            # Read each band
            bands = {}
            for band_name, file_path in band_files.items():
                if band_name in ['B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'BQA']:
                    try:
                        data = self.read_geotiff(file_path)
                        bands[band_name] = data
                        logger.info(f"Loaded band {band_name}")
                    except Exception as e:
                        logger.warning(f"Could not load band {band_name}: {e}")
            
            # Combine into dataset
            ds = xr.Dataset(bands)
            
            # Add metadata
            ds.attrs['source'] = 'Landsat'
            ds.attrs['scene_path'] = str(scene_path)
            ds.attrs['bands'] = list(bands.keys())
            
            logger.info(f"Successfully loaded Landsat scene with bands: {list(bands.keys())}")
            return ds
            
        except Exception as e:
            logger.error(f"Error reading Landsat scene {scene_path}: {e}")
            raise
    
    def reproject_to_common_grid(self,
                               dataset: xr.Dataset,
                               target_crs: str = "EPSG:4326",
                               target_resolution: float = 30.0) -> xr.Dataset:
        """Reproject dataset to a common coordinate reference system."""
        
        try:
            logger.info(f"Reprojecting to {target_crs} with resolution {target_resolution}m")
            
            # Get current bounds and resolution
            bounds = dataset.rio.bounds()
            resolution = dataset.rio.resolution()
            
            # Create target transform
            min_x, min_y, max_x, max_y = bounds
            target_width = int((max_x - min_x) / resolution)
            target_height = int((max_y - min_y) / resolution)
            target_transform = from_bounds(min_x, min_y, max_x, max_y, target_width, target_height)
            
            # Reproject each data variable
            reprojected = {}
            for var_name, data_var in dataset.data_vars.items():
                reprojected_data = xr.zeros_like(
                    data_var.rio.reproject(
                        target_crs,
                        shape=(target_height, target_width),
                        transform=target_transform,
                        resampling=Resampling.nearest
                    )
                )
                reprojected[var_name] = reprojected_data
            
            # Combine back into dataset
            result = xr.Dataset(
                reprojected,
                coords={
                    'x': reprojected_data.x,
                    'y': reprojected_data.y,
                    'spatial_ref': 0
                }
            )
            
            # Set CRS
            result = result.rio.set_crs(target_crs)
            
            logger.info("Reprojection completed successfully")
            return result
            
        except Exception as e:
            logger.error(f"Error during reprojection: {e}")
            raise
    
    def mask_clouds(self,
                   dataset: xr.Dataset,
                   cloud_mask: Optional[xr.DataArray] = None,
                   method: str = 'pixel_qa') -> xr.Dataset:
        """Apply cloud masking to the dataset."""
        
        try:
            logger.info(f"Applying cloud masking using method: {method}")
            
            if method == 'pixel_qa' and 'BQA' in dataset:
                # Use Landsat Pixel QA band for cloud masking
                bqa = dataset['BQA']
                cloud_mask = self._create_landsat_cloud_mask(bqa)
            elif cloud_mask is None:
                logger.warning("No cloud mask provided and BQA band not found")
                return dataset
            
            # Apply mask to all bands
            masked_data = {}
            for var_name, data_var in dataset.data_vars.items():
                if var_name != 'BQA':  # Don't mask the QA band itself
                    masked_data[var_name] = data_var.where(~cloud_mask, np.nan)
            
            # Create new dataset with masked data
            result = xr.Dataset(
                masked_data,
                coords=dataset.coords,
                attrs=dataset.attrs
            )
            
            # Add mask info to attributes
            result.attrs['cloud_masked'] = True
            result.attrs['cloud_coverage'] = float(cloud_mask.sum() / cloud_mask.size)
            
            logger.info(f"Cloud masking completed. Cloud coverage: {result.attrs['cloud_coverage']:.2%}")
            return result
            
        except Exception as e:
            logger.error(f"Error during cloud masking: {e}")
            raise
    
    def _create_landsat_cloud_mask(self, bqa: xr.DataArray) -> xr.DataArray:
        """Create cloud mask from Landsat Pixel QA band."""
        
        # Bit interpretation for Landsat Pixel QA
        # Bit 1: Water
        # Bit 2: Cloud Shadow
        # Bit 3: Snow/Ice
        # Bit 4: Cloud Confidence (low)
        # Bit 5: Cloud Confidence (medium)
        # Bit 6: Cloud Confidence (high)
        # Bit 7: Cloud Shadow Confidence (low)
        # Bit 8: Cloud Shadow Confidence (medium)
        # Bit 9: Cloud Shadow Confidence (high)
        
        cloud_bits = [4, 5, 6]  # Cloud confidence bits
        shadow_bits = [7, 8, 9]  # Cloud shadow confidence bits
        
        # Create bit masks
        cloud_mask = np.zeros_like(bqa.values, dtype=bool)
        
        # Mask high confidence clouds and shadows
        for bit in cloud_bits:
            cloud_mask |= (bqa.values >> (bit - 1)) & 1 == 1
        for bit in shadow_bits:
            cloud_mask |= (bqa.values >> (bit - 1)) & 1 == 1
        
        # Convert to xarray
        cloud_mask_da = xr.DataArray(
            cloud_mask,
            coords=bqa.coords,
            dims=bqa.dims,
            attrs={'description': 'Cloud and shadow mask'}
        )
        
        return cloud_mask_da
    
    def normalize_to_reflectance(self,
                               dataset: xr.Dataset,
                               sensor: str = "landsat8") -> xr.Dataset:
        """Convert digital numbers to surface reflectance."""
        
        try:
            logger.info(f"Normalizing to surface reflectance for {sensor}")
            
            # Calibration constants for different sensors
            if sensor.lower() == "landsat8":
                # Landsat 8 OLI/TIRS
                constants = {
                    'B1': {'ref_gain': 0.012224, 'ref_bias': -60.0},
                    'B2': {'ref_gain': 0.012083, 'ref_bias': -60.0},
                    'B3': {'ref_gain': 0.011519, 'ref_bias': -60.0},
                    'B4': {'ref_gain': 0.011693, 'ref_bias': -60.0},
                    'B5': {'ref_gain': 0.009841, 'ref_bias': -60.0},
                    'B6': {'ref_gain': 0.008193, 'ref_bias': -60.0},
                    'B7': {'ref_gain': 0.006095, 'ref_bias': -60.0}
                }
            elif sensor.lower() == "landsat9":
                # Landsat 9 OLI-2/TIRS-2
                constants = {
                    'B1': {'ref_gain': 0.012089, 'ref_bias': -60.0},
                    'B2': {'ref_gain': 0.012037, 'ref_bias': -60.0},
                    'B3': {'ref_gain': 0.011608, 'ref_bias': -60.0},
                    'B4': {'ref_gain': 0.011531, 'ref_bias': -60.0},
                    'B5': {'ref_gain': 0.009833, 'ref_bias': -60.0},
                    'B6': {'ref_gain': 0.008236, 'ref_bias': -60.0},
                    'B7': {'ref_gain': 0.006094, 'ref_bias': -60.0}
                }
            else:
                logger.warning(f"No calibration constants for {sensor}, skipping normalization")
                return dataset
            
            # Apply calibration to each band
            normalized_data = {}
            for var_name, data_var in dataset.data_vars.items():
                if var_name in constants:
                    gain = constants[var_name]['ref_gain']
                    bias = constants[var_name]['ref_bias']
                    # Convert DN to TOA reflectance
                    toa_reflectance = (data_var * gain + bias) / 10000.0
                    normalized_data[var_name] = toa_reflectance
                else:
                    normalized_data[var_name] = data_var
            
            # Create new dataset
            result = xr.Dataset(
                normalized_data,
                coords=dataset.coords,
                attrs={**dataset.attrs, 'calibrated': True, 'calibration_sensor': sensor}
            )
            
            logger.info("Surface reflectance normalization completed")
            return result
            
        except Exception as e:
            logger.error(f"Error during normalization: {e}")
            raise
    
    def clip_to_bbox(self,
                    dataset: xr.Dataset,
                    bbox: Tuple[float, float, float, float]) -> xr.Dataset:
        """Clip dataset to bounding box."""
        
        try:
            min_x, min_y, max_x, max_y = bbox
            logger.info(f"Clipping to bbox: {bbox}")
            
            clipped = dataset.rio.clip_box(min_x, min_y, max_x, max_y)
            logger.info(f"Clipped from {dataset.sizes} to {clipped.sizes}")
            
            return clipped
            
        except Exception as e:
            logger.error(f"Error during bbox clipping: {e}")
            raise
    
    def resample_to_target(self,
                         dataset: xr.Dataset,
                         target_resolution: float,
                         resampling_method: str = 'nearest') -> xr.Dataset:
        """Resample dataset to target resolution."""
        
        try:
            logger.info(f"Resampling to {target_resolution}m resolution")
            
            resampling_map = {
                'nearest': Resampling.nearest,
                'bilinear': Resampling.bilinear,
                'cubic': Resampling.cubic,
                'average': Resampling.average,
                'mode': Resampling.mode
            }
            
            resampling = resampling_map.get(resampling_method, Resampling.nearest)
            
            resampled = dataset.rio.reproject(
                dataset.rio.crs,
                resolution=target_resolution,
                resampling=resampling
            )
            
            logger.info(f"Resampling completed from {dataset.sizes} to {resampled.sizes}")
            return resampled
            
        except Exception as e:
            logger.error(f"Error during resampling: {e}")
            raise
    
    def write_to_geotiff(self,
                        data: xr.DataArray,
                        output_path: Path,
                        profile: Optional[Dict] = None) -> None:
        """Write xarray data to GeoTIFF."""
        
        try:
            logger.info(f"Writing to GeoTIFF: {output_path}")
            
            # Use rioxarray to write
            data.rio.to_raster(str(output_path))
            logger.info(f"Successfully wrote GeoTIFF to {output_path}")
            
        except Exception as e:
            logger.error(f"Error writing GeoTIFF: {e}")
            raise
    
    def stack_bands(self,
                   dataset: xr.Dataset,
                   band_names: List[str],
                   output_path: Path) -> Path:
        """Stack multiple bands into a single GeoTIFF."""
        
        try:
            logger.info(f"Stacking bands: {band_names}")
            
            # Select requested bands
            if not all(band in dataset.data_vars for band in band_names):
                missing = [b for b in band_names if b not in dataset.data_vars]
                raise ValueError(f"Missing bands: {missing}")
            
            stacked_data = xr.concat(
                [dataset[band] for band in band_names],
                dim='band'
            )
            stacked_data = stacked_data.assign_coords(
                band=range(1, len(band_names) + 1)
            )
            
            # Write to GeoTIFF
            self.write_to_geotiff(stacked_data, output_path)
            logger.info(f"Successfully stacked {len(band_names)} bands to {output_path}")
            
            return output_path
            
        except Exception as e:
            logger.error(f"Error stacking bands: {e}")
            raise
    
    def calculate_statistics(self, dataset: xr.Dataset) -> Dict[str, Dict]:
        """Calculate statistics for each band."""
        
        stats = {}
        
        for var_name, data_var in dataset.data_vars.items():
            try:
                # Remove NaN values for calculation
                valid_data = data_var.values[~np.isnan(data_var.values)]
                
                if len(valid_data) > 0:
                    stats[var_name] = {
                        'count': len(valid_data),
                        'mean': float(np.mean(valid_data)),
                        'std': float(np.std(valid_data)),
                        'min': float(np.min(valid_data)),
                        'max': float(np.max(valid_data)),
                        'percentile_5': float(np.percentile(valid_data, 5)),
                        'percentile_95': float(np.percentile(valid_data, 95))
                    }
                else:
                    stats[var_name] = {
                        'count': 0,
                        'mean': np.nan,
                        'std': np.nan,
                        'min': np.nan,
                        'max': np.nan,
                        'percentile_5': np.nan,
                        'percentile_95': np.nan
                    }
                    
            except Exception as e:
                logger.warning(f"Could not calculate statistics for {var_name}: {e}")
                stats[var_name] = {'error': str(e)}
        
        return stats