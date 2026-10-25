"""Focused regression checks for the exact street join."""
import copy
import csv
import json
import unittest
from pathlib import Path
from enrich import enrich

class EnrichTests(unittest.TestCase):
    def setUp(self) -> None:
        self.geo = {'type':'FeatureCollection','features':[{'type':'Feature','properties':{'NOMBRE_ART':'ÑANDÚ'},'geometry':{'type':'LineString','coordinates':[[-70,-33],[-70.1,-33.1]]}}]}
        self.rows = [{'NOMBRE_ART':'ÑANDÚ','N_TRAMOS':'1','ESTADO':'PENDIENTE','DESCRIPCION':'Por determinar'}]
    def test_preserve(self) -> None:
        original=copy.deepcopy(self.geo)
        result,report=enrich(self.geo,self.rows)
        self.assertEqual(self.geo,original)
        self.assertEqual(result['features'][0]['geometry'],original['features'][0]['geometry'])
        self.assertEqual(result['features'][0]['properties']['DESCRIPCION'],'Por determinar')
        self.assertTrue(report['geometry_unchanged'])
    def test_duplicate_or_missing(self) -> None:
        with self.assertRaises(ValueError): enrich(self.geo,self.rows*2)
        with self.assertRaises(ValueError): enrich(self.geo,[{**self.rows[0],'NOMBRE_ART':'NANDU'}])
    def test_count(self) -> None:
        with self.assertRaises(ValueError): enrich(self.geo,[{**self.rows[0],'N_TRAMOS':'2'}])
    def test_crs_empty(self) -> None:
        bad=copy.deepcopy(self.geo);bad['crs']={'properties':{'name':'EPSG:3857'}}
        with self.assertRaises(ValueError): enrich(bad,self.rows)
        self.geo['features'][0]['geometry']['coordinates']=[]
        with self.assertRaises(ValueError): enrich(self.geo,self.rows)
    def test_multiline(self) -> None:
        g=self.geo['features'][0]['geometry'];g['type']='MultiLineString';g['coordinates']=[g['coordinates']]
        result,_=enrich(self.geo,self.rows)
        self.assertEqual(result['features'][0]['geometry'],g)
    def test_delivered_data(self) -> None:
        root=Path(__file__).resolve().parent
        data=json.loads((root/'calles.geojson').read_text(encoding='utf-8'))
        with (root/'catalogo.csv').open(encoding='utf-8-sig',newline='') as f: rows=list(csv.DictReader(f))
        self.assertEqual(len(data['features']),2855)
        self.assertEqual(len(rows),465)
        catalog={r['NOMBRE_ART']:r for r in rows}
        for f in data['features']:
            p=f['properties'];r=catalog[p['NOMBRE_ART']]
            for key in ['DESCRIPCION','ESTADO','URL_FUENTE','TEXTO_POPUP']:
                self.assertEqual(p[key],r[key])
if __name__=='__main__': unittest.main()
