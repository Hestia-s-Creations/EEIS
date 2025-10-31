"""Spectral indices calculation for satellite data analysis."""

import logging
import numpy as np
import xarray as xr
from typing import Dict, List, Optional, Union, Tuple
from scipy import ndimage

from ..config import Settings


logger = logging.getLogger(__name__)


class SpectralIndices:
    """Class for calculating various spectral indices from satellite data."""
    
    def __init__(self, settings: Settings):
        self.settings = settings
    
    def calculate_ndvi(self, dataset: xr.Dataset, red_band: str = "B4", nir_band: str = "B5") -> xr.DataArray:
        """Calculate Normalized Difference Vegetation Index (NDVI)."""
        
        try:
            logger.info("Calculating NDVI")
            
            if red_band not in dataset.data_vars:
                raise ValueError(f"Red band {red_band} not found in dataset")
            if nir_band not in dataset.data_vars:
                raise ValueError(f"NIR band {nir_band} not found in dataset")
            
            red = dataset[red_band]
            nir = dataset[nir_band]
            
            # Calculate NDVI: (NIR - Red) / (NIR + Red)
            denominator = nir + red
            ndvi = xr.where(
                denominator != 0,
                (nir - red) / denominator,
                np.nan
            )
            
            ndvi.attrs = {
                'description': 'Normalized Difference Vegetation Index',
                'formula': '(NIR - Red) / (NIR + Red)',
                'range': '[-1, 1]',
                'red_band': red_band,
                'nir_band': nir_band,
                'vegetation_interpretation': {
                    'negative': 'Water/Clouds/Rock',
                    '0_to_0.2': 'Bare soil/Sparse vegetation',
                    '0.2_to_0.4': 'Grassland/Shrubland',
                    '0.4_to_0.6': 'Moderate vegetation',
                    '0.6_to_0.8': 'Dense vegetation',
                    '0.8_to_1.0': 'Very dense vegetation'
                }
            }
            
            return ndvi
            
        except Exception as e:
            logger.error(f"Error calculating NDVI: {e}")
            raise
    
    def calculate_nbr(self, dataset: xr.Dataset, nir_band: str = "B5", swir2_band: str = "B7") -> xr.DataArray:
        """Calculate Normalized Burn Ratio (NBR)."""
        
        try:
            logger.info("Calculating NBR")
            
            if nir_band not in dataset.data_vars:
                raise ValueError(f"NIR band {nir_band} not found in dataset")
            if swir2_band not in dataset.data_vars:
                raise ValueError(f"SWIR2 band {swir2_band} not found in dataset")
            
            nir = dataset[nir_band]
            swir2 = dataset[swir2_band]
            
            # Calculate NBR: (NIR - SWIR2) / (NIR + SWIR2)
            denominator = nir + swir2
            nbr = xr.where(
                denominator != 0,
                (nir - swir2) / denominator,
                np.nan
            )
            
            nbr.attrs = {
                'description': 'Normalized Burn Ratio',
                'formula': '(NIR - SWIR2) / (NIR + SWIR2)',
                'range': '[-1, 1]',
                'nir_band': nir_band,
                'swir2_band': swir2_band,
                'burn_severity_interpretation': {
                    '>0.5': 'Unburned/Healthy vegetation',
                    '0.1_to_0.5': 'Low severity burn',
                    '-0.1_to_0.1': 'Moderate severity burn',
                    '<-0.1': 'High severity burn'
                }
            }
            
            return nbr
            
        except Exception as e:
            logger.error(f"Error calculating NBR: {e}")
            raise
    
    def calculate_tcg(self, dataset: xr.Dataset, green_band: str = "B3", red_band: str = "B4", nir_band: str = "B5") -> xr.DataArray:
        """Calculate Tasseled Cap Greenness (TCG)."""
        
        try:
            logger.info("Calculating TCG (Tasseled Cap Greenness)")
            
            # Tasseled Cap coefficients for Landsat 8 OLI
            coefficients = {
                'B1': 0.2043, 'B2': 0.4158, 'B3': 0.5524, 
                'B4': 0.5741, 'B5': 0.3124, 'B6': 0.2303, 'B7': 0.1079
            }
            
            # Calculate TCG using available bands
            tcg_sum = 0
            for band, coeff in coefficients.items():
                if band in dataset.data_vars:
                    tcg_sum += dataset[band] * coeff
                else:
                    logger.warning(f"Band {band} not found, using coefficient 0")
            
            tcg = tcg_sum
            
            tcg.attrs = {
                'description': 'Tasseled Cap Greenness',
                'formula': 'Sum of (band * coefficient)',
                'coefficients': coefficients,
                'interpretation': 'Higher values indicate greener vegetation'
            }
            
            return tcg
            
        except Exception as e:
            logger.error(f"Error calculating TCG: {e}")
            raise
    
    def calculate_tcw(self, dataset: xr.Dataset) -> xr.DataArray:
        """Calculate Tasseled Cap Wetness (TCW)."""
        
        try:
            logger.info("Calculating TCW (Tasseled Cap Wetness)")
            
            # Tasseled Cap coefficients for Landsat 8 OLI
            coefficients = {
                'B1': 0.1509, 'B2': 0.1793, 'B3': 0.1820,
                'B4': 0.1833, 'B5': -0.0453, 'B6': -0.2903, 'B7': -0.2964
            }
            
            # Calculate TCW using available bands
            tcw_sum = 0
            for band, coeff in coefficients.items():
                if band in dataset.data_vars:
                    tcw_sum += dataset[band] * coeff
                else:
                    logger.warning(f"Band {band} not found, using coefficient 0")
            
            tcw = tcw_sum
            
            tcw.attrs = {
                'description': 'Tasseled Cap Wetness',
                'formula': 'Sum of (band * coefficient)',
                'coefficients': coefficients,
                'interpretation': 'Higher values indicate wetter conditions'
            }
            
            return tcw
            
        except Exception as e:
            logger.error(f"Error calculating TCW: {e}")
            raise
    
    def calculate_tcb(self, dataset: xr.Dataset) -> xr.DataArray:
        """Calculate Tasseled Cap Brightness (TCB)."""
        
        try:
            logger.info("Calculating TCB (Tasseled Cap Brightness)")
            
            # Tasseled Cap coefficients for Landsat 8 OLI
            coefficients = {
                'B1': 0.3029, 'B2': 0.2786, 'B3': 0.4733,
                'B4': 0.5599, 'B5': 0.5080, 'B6': 0.1872, 'B7': 0.1070
            }
            
            # Calculate TCB using available bands
            tcb_sum = 0
            for band, coeff in coefficients.items():
                if band in dataset.data_vars:
                    tcb_sum += dataset[band] * coeff
                else:
                    logger.warning(f"Band {band} not found, using coefficient 0")
            
            tcb = tcb_sum
            
            tcb.attrs = {
                'description': 'Tasseled Cap Brightness',
                'formula': 'Sum of (band * coefficient)',
                'coefficients': coefficients,
                'interpretation': 'Higher values indicate brighter surfaces'
            }
            
            return tcb
            
        except Exception as e:
            logger.error(f"Error calculating TCB: {e}")
            raise
    
    def calculate_evi(self, dataset: xr.Dataset, blue_band: str = "B2", red_band: str = "B4", nir_band: str = "B5") -> xr.DataArray:
        """Calculate Enhanced Vegetation Index (EVI)."""
        
        try:
            logger.info("Calculating EVI")
            
            if blue_band not in dataset.data_vars:
                raise ValueError(f"Blue band {blue_band} not found in dataset")
            if red_band not in dataset.data_vars:
                raise ValueError(f"Red band {red_band} not found in dataset")
            if nir_band not in dataset.data_vars:
                raise ValueError(f"NIR band {nir_band} not found in dataset")
            
            blue = dataset[blue_band]
            red = dataset[red_band]
            nir = dataset[nir_band]
            
            # Calculate EVI: 2.5 * (NIR - Red) / (NIR + 6*Red - 7.5*Blue + 1)
            numerator = nir - red
            denominator = nir + 6*red - 7.5*blue + 1
            
            evi = xr.where(
                denominator != 0,
                2.5 * numerator / denominator,
                np.nan
            )
            
            evi.attrs = {
                'description': 'Enhanced Vegetation Index',
                'formula': '2.5 * (NIR - Red) / (NIR + 6*Red - 7.5*Blue + 1)',
                'range': '[-1, 1]',
                'blue_band': blue_band,
                'red_band': red_band,
                'nir_band': nir_band,
                'advantages': 'Less sensitive to soil background and atmospheric effects'
            }
            
            return evi
            
        except Exception as e:
            logger.error(f"Error calculating EVI: {e}")
            raise
    
    def calculate_ndwi(self, dataset: xr.Dataset, green_band: str = "B3", nir_band: str = "B5") -> xr.DataArray:
        """Calculate Normalized Difference Water Index (NDWI)."""
        
        try:
            logger.info("Calculating NDWI")
            
            if green_band not in dataset.data_vars:
                raise ValueError(f"Green band {green_band} not found in dataset")
            if nir_band not in dataset.data_vars:
                raise ValueError(f"NIR band {nir_band} not found in dataset")
            
            green = dataset[green_band]
            nir = dataset[nir_band]
            
            # Calculate NDWI: (Green - NIR) / (Green + NIR)
            denominator = green + nir
            ndwi = xr.where(
                denominator != 0,
                (green - nir) / denominator,
                np.nan
            )
            
            ndwi.attrs = {
                'description': 'Normalized Difference Water Index',
                'formula': '(Green - NIR) / (Green + NIR)',
                'range': '[-1, 1]',
                'green_band': green_band,
                'nir_band': nir_band,
                'water_interpretation': {
                    '>0.3': 'Water bodies',
                    '0_to_0.3': 'Wet soil/Moist vegetation',
                    '<0': 'Dry soil/Dry vegetation'
                }
            }
            
            return ndwi
            
        except Exception as e:
            logger.error(f"Error calculating NDWI: {e}")
            raise
    
    def calculate_ndsi(self, dataset: xr.Dataset, green_band: str = "B3", swir1_band: str = "B6") -> xr.DataArray:
        """Calculate Normalized Difference Snow Index (NDSI)."""
        
        try:
            logger.info("Calculating NDSI")
            
            if green_band not in dataset.data_vars:
                raise ValueError(f"Green band {green_band} not found in dataset")
            if swir1_band not in dataset.data_vars:
                raise ValueError(f"SWIR1 band {swir1_band} not found in dataset")
            
            green = dataset[green_band]
            swir1 = dataset[swir1_band]
            
            # Calculate NDSI: (Green - SWIR1) / (Green + SWIR1)
            denominator = green + swir1
            ndsi = xr.where(
                denominator != 0,
                (green - swir1) / denominator,
                np.nan
            )
            
            ndsi.attrs = {
                'description': 'Normalized Difference Snow Index',
                'formula': '(Green - SWIR1) / (Green + SWIR1)',
                'range': '[-1, 1]',
                'green_band': green_band,
                'swir1_band': swir1_band,
                'snow_interpretation': {
                    '>0.4': 'Snow/Ice',
                    '0.2_to_0.4': 'Snow mixture',
                    '<0.2': 'No snow'
                }
            }
            
            return ndsi
            
        except Exception as e:
            logger.error(f"Error calculating NDSI: {e}")
            raise
    
    def calculate_savi(self, dataset: xr.Dataset, red_band: str = "B4", nir_band: str = "B5", L: float = 0.5) -> xr.DataArray:
        """Calculate Soil Adjusted Vegetation Index (SAVI)."""
        
        try:
            logger.info("Calculating SAVI")
            
            if red_band not in dataset.data_vars:
                raise ValueError(f"Red band {red_band} not found in dataset")
            if nir_band not in dataset.data_vars:
                raise ValueError(f"NIR band {nir_band} not found in dataset")
            
            red = dataset[red_band]
            nir = dataset[nir_band]
            
            # Calculate SAVI: (NIR - Red) / (NIR + Red + L) * (1 + L)
            denominator = nir + red + L
            savi = xr.where(
                denominator != 0,
                ((nir - red) / denominator) * (1 + L),
                np.nan
            )
            
            savi.attrs = {
                'description': 'Soil Adjusted Vegetation Index',
                'formula': '((NIR - Red) / (NIR + Red + L)) * (1 + L)',
                'range': '[-1, 1]',
                'red_band': red_band,
                'nir_band': nir_band,
                'L_parameter': L,
                'advantages': 'Reduces soil background noise'
            }
            
            return savi
            
        except Exception as e:
            logger.error(f"Error calculating SAVI: {e}")
            raise
    
    def calculate_plant_stress_index(self, dataset: xr.Dataset) -> xr.DataArray:
        """Calculate plant stress index using multiple bands."""
        
        try:
            logger.info("Calculating plant stress index")
            
            if not all(band in dataset.data_vars for band in ['B4', 'B5', 'B6']):
                raise ValueError("Red, NIR, and SWIR1 bands required")
            
            red = dataset['B4']
            nir = dataset['B5']
            swir1 = dataset['B6']
            
            # Simple stress index based on SWIR reflectance
            # Higher SWIR indicates water stress
            stress_index = swir1 / (nir + 1e-10)
            
            # Normalize to 0-1 range
            stress_normalized = (stress_index - stress_index.min()) / (stress_index.max() - stress_index.min())
            
            stress_normalized.attrs = {
                'description': 'Plant stress index',
                'formula': 'Normalized SWIR/NIR ratio',
                'range': '[0, 1]',
                'interpretation': 'Higher values indicate higher plant stress'
            }
            
            return stress_normalized
            
        except Exception as e:
            logger.error(f"Error calculating plant stress index: {e}")
            raise
    
    def calculate_variability_indices(self, dataset: xr.Dataset) -> xr.Dataset:
        """Calculate multiple vegetation indices at once."""
        
        try:
            logger.info("Calculating vegetation variability indices")
            
            # Check which bands are available
            available_bands = list(dataset.data_vars.keys())
            
            indices = {}
            
            # NDVI (if red and NIR available)
            if 'B4' in available_bands and 'B5' in available_bands:
                indices['NDVI'] = self.calculate_ndvi(dataset)
            
            # NBR (if NIR and SWIR2 available)
            if 'B5' in available_bands and 'B7' in available_bands:
                indices['NBR'] = self.calculate_nbr(dataset)
            
            # TCG (tasseled cap greenness)
            if len(set(['B3', 'B4', 'B5']) & set(available_bands)) >= 2:
                indices['TCG'] = self.calculate_tcg(dataset)
                indices['TCW'] = self.calculate_tcw(dataset)
                indices['TCB'] = self.calculate_tcb(dataset)
            
            # EVI (if blue, red, NIR available)
            if all(band in available_bands for band in ['B2', 'B4', 'B5']):
                indices['EVI'] = self.calculate_evi(dataset)
            
            # NDWI (if green and NIR available)
            if 'B3' in available_bands and 'B5' in available_bands:
                indices['NDWI'] = self.calculate_ndwi(dataset)
            
            # NDSI (if green and SWIR1 available)
            if 'B3' in available_bands and 'B6' in available_bands:
                indices['NDSI'] = self.calculate_ndsi(dataset)
            
            # SAVI (if red and NIR available)
            if 'B4' in available_bands and 'B5' in available_bands:
                indices['SAVI'] = self.calculate_savi(dataset)
            
            # Plant stress index
            if len(set(['B4', 'B5', 'B6']) & set(available_bands)) >= 2:
                indices['STRESS'] = self.calculate_plant_stress_index(dataset)
            
            if not indices:
                logger.warning("No suitable bands found for vegetation indices calculation")
                return xr.Dataset()
            
            # Create dataset with all indices
            indices_dataset = xr.Dataset(indices)
            
            logger.info(f"Calculated {len(indices)} vegetation indices")
            return indices_dataset
            
        except Exception as e:
            logger.error(f"Error calculating variability indices: {e}")
            raise