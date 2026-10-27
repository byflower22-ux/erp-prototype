(function (root, factory) {
  const api = factory();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.ReceiptLogic = api;
  }
}(typeof window !== 'undefined' ? window : globalThis, function () {
  function atStartOfDay(value) {
    const date = new Date(value);
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function atEndOfDay(value) {
    const date = atStartOfDay(value);
    date.setHours(23, 59, 59, 999);
    return date;
  }

  function getPresetRange(preset, now) {
    if (!preset || preset === '全部' || preset === 'all') {
      return null;
    }

    const current = atStartOfDay(now || new Date());
    const currentYear = current.getFullYear();
    const currentMonth = current.getMonth();
    let start;
    let end;

    switch (preset) {
      case '\u672c\u5468': {
        const daysSinceMonday = (current.getDay() + 6) % 7;
        start = new Date(currentYear, currentMonth, current.getDate() - daysSinceMonday);
        end = atEndOfDay(new Date(currentYear, currentMonth, current.getDate() - daysSinceMonday + 6));
        break;
      }
      case '\u4e0a\u5468': {
        const daysSinceMonday = (current.getDay() + 6) % 7;
        start = new Date(currentYear, currentMonth, current.getDate() - daysSinceMonday - 7);
        end = atEndOfDay(new Date(currentYear, currentMonth, current.getDate() - daysSinceMonday - 1));
        break;
      }
      case '今天':
        start = current;
        end = atEndOfDay(current);
        break;
      case '昨天':
        start = new Date(currentYear, currentMonth, current.getDate() - 1);
        end = atEndOfDay(start);
        break;
      case '近7天':
        start = new Date(currentYear, currentMonth, current.getDate() - 6);
        end = atEndOfDay(current);
        break;
      case '本月':
        start = new Date(currentYear, currentMonth, 1);
        end = atEndOfDay(new Date(currentYear, currentMonth + 1, 0));
        break;
      case '上月':
        start = new Date(currentYear, currentMonth - 1, 1);
        end = atEndOfDay(new Date(currentYear, currentMonth, 0));
        break;
      case '本季度': {
        const quarterStartMonth = Math.floor(currentMonth / 3) * 3;
        start = new Date(currentYear, quarterStartMonth, 1);
        end = atEndOfDay(new Date(currentYear, quarterStartMonth + 3, 0));
        break;
      }
      case '上季度': {
        const previousQuarterStartMonth = Math.floor(currentMonth / 3) * 3 - 3;
        start = new Date(currentYear, previousQuarterStartMonth, 1);
        end = atEndOfDay(new Date(currentYear, previousQuarterStartMonth + 3, 0));
        break;
      }
      case '本年':
        start = new Date(currentYear, 0, 1);
        end = atEndOfDay(new Date(currentYear, 12, 0));
        break;
      case '去年':
        start = new Date(currentYear - 1, 0, 1);
        end = atEndOfDay(new Date(currentYear - 1, 12, 0));
        break;
      default:
        return null;
    }

    return { start, end };
  }

  function hasValue(value) {
    return value !== undefined && value !== null && value !== '' && value !== '全部' && value !== 'all';
  }

  function toBooleanFilter(value) {
    if (!hasValue(value)) {
      return null;
    }
    if (typeof value === 'boolean') {
      return value;
    }
    return value === 'true' || value === '是' || value === 1 || value === '1';
  }

  function toDate(value, isEnd) {
    if (!value) {
      return null;
    }
    const isDateOnly = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
    const dateParts = isDateOnly ? value.split('-').map(Number) : null;
    const date = isDateOnly
      ? new Date(dateParts[0], dateParts[1] - 1, dateParts[2])
      : new Date(value);
    if (Number.isNaN(date.getTime())) {
      return null;
    }
    if (isDateOnly) {
      return isEnd ? atEndOfDay(date) : atStartOfDay(date);
    }
    return date;
  }

  function matchesField(document, field, expected) {
    return !hasValue(expected) || document[field] === expected;
  }

  function filterDocuments(documents, filters, now) {
    const activeFilters = filters || {};
    const keyword = String(activeFilters.keyword || '').trim().toLocaleLowerCase();
    const presetRange = getPresetRange(activeFilters.datePreset, now);
    const approvalPresetRange = getPresetRange(activeFilters.approvalDatePreset, now);
    const suppliedRange = activeFilters.dateRange || {};
    const start = toDate(suppliedRange.start || activeFilters.startDate, false) || (presetRange && presetRange.start);
    const end = toDate(suppliedRange.end || activeFilters.endDate, true) || (presetRange && presetRange.end);
    const approvalStart = toDate(activeFilters.approvalStartDate, false)
      || (approvalPresetRange && approvalPresetRange.start);
    const approvalEnd = toDate(activeFilters.approvalEndDate, true)
      || (approvalPresetRange && approvalPresetRange.end);
    const overseas = toBooleanFilter(activeFilters.overseas);
    const invoice = toBooleanFilter(activeFilters.invoice);

    return (documents || []).filter(function (document) {
      const text = [
        document.id,
        document.title,
        document.applicant,
        document.department,
        document.content,
      ].join(' ').toLocaleLowerCase();
      const createdAt = toDate(document.createdAt, false);
      const approvalPassedAt = toDate(document.approvalPassedAt, false);

      return (!keyword || text.includes(keyword))
        && matchesField(document, 'status', activeFilters.status)
        && matchesField(document, 'receiptStatus', activeFilters.receiptStatus)
        && matchesField(document, 'kingdeeStatus', activeFilters.kingdeeStatus)
        && matchesField(document, 'type', activeFilters.type)
        && matchesField(document, 'payer', activeFilters.payer)
        && matchesField(document, 'payeeType', activeFilters.payeeType)
        && (overseas === null || Boolean(document.overseas) === overseas)
        && (invoice === null || Boolean(document.invoice) === invoice)
        && (!start || (createdAt && createdAt >= start))
        && (!end || (createdAt && createdAt <= end))
        && (!approvalStart || (approvalPassedAt && approvalPassedAt >= approvalStart))
        && (!approvalEnd || (approvalPassedAt && approvalPassedAt <= approvalEnd));
    });
  }

  function paginate(items, requestedPage, pageSize) {
    const source = Array.isArray(items) ? items : [];
    const normalizedPageSize = Math.max(1, Number.parseInt(pageSize, 10) || 10);
    const total = source.length;
    const totalPages = Math.max(1, Math.ceil(total / normalizedPageSize));
    const requested = Number.parseInt(requestedPage, 10) || 1;
    const page = Math.min(Math.max(requested, 1), totalPages);
    const start = (page - 1) * normalizedPageSize;

    return {
      items: source.slice(start, start + normalizedPageSize),
      page,
      pageSize: normalizedPageSize,
      total,
      totalPages,
    };
  }

  return { filterDocuments, getPresetRange, paginate };
}));
