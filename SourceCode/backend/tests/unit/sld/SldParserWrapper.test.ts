import { describe, it, expect } from 'vitest';
import { SldParserWrapper } from '../../../src/sld/SldParserWrapper.js';
import type { Style } from 'geostyler-style';

describe('SldParserWrapper', () => {
  const wrapper = new SldParserWrapper();

  const simplePointStyle: Style = {
    name: 'Red point',
    rules: [{
      name: 'Default rule',
      symbolizers: [{
        kind: 'Mark',
        wellKnownName: 'circle',
        size: 8,
        color: '#FF0000',
      }],
    }],
  };

  it('writes SLD XML', async () => {
    const xml = await wrapper.writeStyle(simplePointStyle);
    expect(xml).toContain('<?xml');
    expect(xml).toContain('<StyledLayerDescriptor');
    expect(xml).toContain('<Mark>');
  });

  it('pretty-prints by default', async () => {
    const xml = await wrapper.writeStyle(simplePointStyle);
    expect(xml).toContain('\n');
    expect(xml).toMatch(/\n  </);
  });

  it('respects prettyPrint=false', async () => {
    const xml = await wrapper.writeStyle(simplePointStyle, { prettyPrint: false });
    expect(xml).not.toContain('\n  <');
  });

  it('strips Geometry nodes when reading SLD', async () => {
    const xml = `
      <?xml version="1.0" encoding="UTF-8"?>
      <StyledLayerDescriptor version="1.0.0" xmlns="http://www.opengis.net/sld">
        <NamedLayer>
          <Name>Test</Name>
          <UserStyle>
            <FeatureTypeStyle>
              <Rule>
                <PointSymbolizer>
                  <Geometry>
                    <ogc:PropertyName xmlns:ogc="http://www.opengis.net/ogc">the_geom</ogc:PropertyName>
                  </Geometry>
                  <Graphic>
                    <Mark>
                      <WellKnownName>circle</WellKnownName>
                      <Fill>
                        <CssParameter name="fill">#FF0000</CssParameter>
                      </Fill>
                    </Mark>
                    <Size>8</Size>
                  </Graphic>
                </PointSymbolizer>
              </Rule>
            </FeatureTypeStyle>
          </UserStyle>
        </NamedLayer>
      </StyledLayerDescriptor>
    `;
    const style = await wrapper.readStyle(xml);
    expect(style.name).toBe('Test');
  });
});
