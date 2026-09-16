import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { SearchInput } from './SearchInput';

describe('SearchInput', () => {
  it('debounces the trimmed query instead of firing per keystroke', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SearchInput value="" onChange={onChange} label="Search tasks" />);

    await user.type(screen.getByLabelText('Search tasks'), ' report ');
    expect(onChange).not.toHaveBeenCalled();

    await waitFor(() => expect(onChange).toHaveBeenCalledWith('report'));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('shows a query the caller changes, e.g. when filters are cleared', async () => {
    function Harness() {
      const [value, setValue] = useState('report');
      return (
        <>
          <button onClick={() => setValue('')}>Clear</button>
          <SearchInput value={value} onChange={setValue} label="Search tasks" />
        </>
      );
    }
    const user = userEvent.setup();
    render(<Harness />);
    expect(screen.getByLabelText('Search tasks')).toHaveValue('report');

    await user.click(screen.getByRole('button', { name: 'Clear' }));
    expect(screen.getByLabelText('Search tasks')).toHaveValue('');
  });
});
