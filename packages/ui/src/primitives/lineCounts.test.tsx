import { screen } from '@testing-library/react-native';
import { DisclosureChevron, LineCounts } from '../index';
import { renderThemed } from '../test-utils';

describe('LineCounts', () => {
  it('draws the true minus sign and leaves a zero side out', async () => {
    await renderThemed(<LineCounts added={12} removed={0} />);
    expect(screen.getByText('+12')).toBeTruthy();
    expect(screen.queryByText(/^[−-]/)).toBeNull();
  });

  it('draws nothing for two zeros unless showZero is set', async () => {
    await renderThemed(<LineCounts added={0} removed={0} testID="counts" />);
    expect(screen.queryByTestId('counts')).toBeNull();
  });

  it('draws both zeros with showZero', async () => {
    await renderThemed(<LineCounts added={0} removed={3} showZero />);
    expect(screen.getByText('+0')).toBeTruthy();
    expect(screen.getByText('−3')).toBeTruthy();
  });
});

describe('DisclosureChevron', () => {
  it('turns down when expanded and takes a size and color', async () => {
    await renderThemed(<DisclosureChevron expanded size={14} color="textTertiary" />);
    expect(screen.getByTestId('disclosure')).toHaveStyle({ transform: [{ rotate: '90deg' }] });
  });
});
