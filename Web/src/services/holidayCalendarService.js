import api from './api';

const holidayCalendarService = {
  /**
   * Get holidays for a specific year
   * @param {number} year
   * @returns {Promise<{ holidays: Array, totalDays: number }>}
   */
  getHolidays: async (year) => {
    const response = await api.get('/settings/holiday-calendar', {
      params: { year },
    });
    return response.data.data || response.data;
  },

  /**
   * Save holiday calendar for a year
   * @param {number} year
   * @param {Array<{ name: string, startDate: string, endDate: string, compensatoryDate?: string }>} holidays
   * @returns {Promise<{ holidays: Array, totalDays: number }>}
   */
  saveHolidays: async (year, holidays) => {
    const response = await api.put('/settings/holiday-calendar', {
      year,
      holidays,
    });
    return response.data.data || response.data;
  },
};

export default holidayCalendarService;
