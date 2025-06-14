import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Plus,
  Search,
  Filter,
  Download,
  Eye,
  Edit,
  Trash2,
  Calendar,
  User,
  Building,
  TrendingUp,
  TrendingDown,
  Activity,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  X,
  ChevronDown,
  ChevronRight,
  Loader2
} from 'lucide-react';
import { supabase, Database } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import AddEditRiskForm from './AddEditRiskForm';

type Risk = Database['public']['Tables']['risks']['Row'];
type RiskInsert = Database['public']['Tables']['risks']['Insert'];

const RiskManagement: React.FC = () => {
  const [risks, setRisks] = useState<Risk[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterRiskLevel, setFilterRiskLevel] = useState<string>('all');
  const [sortField, setSortField] = useState<string>('risk_score');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [selectedRisk, setSelectedRisk] = useState<Risk | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editingRisk, setEditingRisk] = useState<Risk | null>(null);

  const { user, profile, hasPermission } = useAuth();

  useEffect(() => {
    fetchRisks();
  }, []);

  const fetchRisks = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { data, error: fetchError } = await supabase
        .from('risks')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) {
        throw fetchError;
      }

      setRisks(data || []);
    } catch (err) {
      console.error('Error fetching risks:', err);
      setError('Failed to load risk data');
    } finally {
      setLoading(false);
    }
  };

  const logAuditEvent = async (action: string, resourceId?: string, details?: Record<string, any>) => {
    if (!profile?.organization_id) {
      console.warn('Cannot log audit event: no organization ID available');
      return;
    }
    
    try {
      const { error } = await supabase.from('audit_logs').insert({
        user_id: user?.id || null,
        organization_id: profile.organization_id,
        action,
        resource_type: 'risk',
        resource_id: resourceId,
        details,
        ip_address: null, // We'll skip IP detection for now
        user_agent: navigator.userAgent
      });

      if (error) {
        console.error('Error logging audit event:', error);
      }
    } catch (error) {
      console.error('Unexpected error logging audit event:', error);
    }
  };

  const handleCreateRisk = async (formData: RiskInsert) => {
    try {
      setLoading(true);
      setError(null);

      const riskData: RiskInsert = {
        ...formData,
        organization_id: profile?.organization_id || '',
        identified_by_user_id: user?.id || null,
        owner_user_id: formData.owner_user_id || user?.id || null,
        department: formData.department || profile?.department || null
      };

      const { data, error } = await supabase
        .from('risks')
        .insert([riskData])
        .select()
        .single();

      if (error) {
        throw error;
      }

      // Log the creation in audit logs
      if (data) {
        await logAuditEvent('risk_created', data.id, { 
          risk_title: data.title,
          risk_category: data.category,
          risk_score: data.risk_score
        });
      }

      await fetchRisks();
      setShowAddForm(false);
    } catch (err) {
      console.error('Error adding risk:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateRisk = async (formData: RiskInsert) => {
    if (!editingRisk) return;

    try {
      setLoading(true);
      setError(null);

      const updateData = {
        ...formData,
        organization_id: profile?.organization_id,
        last_reviewed_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('risks')
        .update(updateData)
        .eq('id', editingRisk.id)
        .select()
        .single();

      if (error) {
        throw error;
      }

      // Log the update in audit logs
      if (data) {
        await logAuditEvent('risk_updated', data.id, { 
          risk_title: data.title,
          risk_category: data.category,
          risk_score: data.risk_score,
          previous_status: editingRisk.status,
          new_status: data.status
        });
      }

      await fetchRisks();
      setShowEditForm(false);
      setEditingRisk(null);
    } catch (err) {
      console.error('Error updating risk:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRisk = async (riskId: string, riskTitle: string) => {
    if (!confirm('Are you sure you want to delete this risk? This action cannot be undone.')) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      // Get risk details before deletion for audit log
      const { data: riskData } = await supabase
        .from('risks')
        .select('title, category, risk_score, status')
        .eq('id', riskId)
        .single();
      
      // Delete the risk
      const { error } = await supabase
        .from('risks')
        .delete()
        .eq('id', riskId);

      if (error) {
        throw error;
      }

      // Log the deletion in audit logs
      await logAuditEvent('risk_deleted', riskId, { 
        risk_title: riskTitle,
        risk_details: riskData || {},
        deleted_at: new Date().toISOString()
      });

      // Close the detail view if the deleted risk was selected
      if (selectedRisk?.id === riskId) {
        setSelectedRisk(null);
      }
      
      await fetchRisks();
    } catch (err) {
      console.error('Error deleting risk:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete risk');
    } finally {
      setLoading(false);
    }
  };

  const openEditForm = (risk: Risk) => {
    setEditingRisk(risk);
    setShowEditForm(true);
  };

  const getRiskLevelColor = (score: number) => {
    if (score <= 5) return 'text-green-600 bg-green-100 border-green-200';
    if (score <= 12) return 'text-yellow-600 bg-yellow-100 border-yellow-200';
    if (score <= 20) return 'text-orange-600 bg-orange-100 border-orange-200';
    return 'text-red-600 bg-red-100 border-red-200';
  };

  const getRiskLevel = (score: number) => {
    if (score <= 5) return 'Low';
    if (score <= 12) return 'Medium';
    if (score <= 20) return 'High';
    return 'Critical';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'identified': return 'bg-blue-100 text-blue-700';
      case 'assessed': return 'bg-yellow-100 text-yellow-700';
      case 'mitigated': return 'bg-green-100 text-green-700';
      case 'monitoring': return 'bg-purple-100 text-purple-700';
      case 'closed': return 'bg-gray-100 text-gray-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'identified': return <AlertCircle className="w-4 h-4" />;
      case 'assessed': return <Eye className="w-4 h-4" />;
      case 'mitigated': return <CheckCircle className="w-4 h-4" />;
      case 'monitoring': return <Activity className="w-4 h-4" />;
      case 'closed': return <XCircle className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  const filteredRisks = risks.filter(risk => {
    const matchesSearch = risk.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         risk.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === 'all' || risk.category === filterCategory;
    const matchesStatus = filterStatus === 'all' || risk.status === filterStatus;
    
    let matchesRiskLevel = true;
    if (filterRiskLevel === 'low') matchesRiskLevel = risk.risk_score <= 5;
    else if (filterRiskLevel === 'medium') matchesRiskLevel = risk.risk_score > 5 && risk.risk_score <= 12;
    else if (filterRiskLevel === 'high') matchesRiskLevel = risk.risk_score > 12 && risk.risk_score <= 20;
    else if (filterRiskLevel === 'critical') matchesRiskLevel = risk.risk_score > 20;
    
    return matchesSearch && matchesCategory && matchesStatus && matchesRiskLevel;
  });

  const sortedRisks = [...filteredRisks].sort((a, b) => {
    const aValue = a[sortField as keyof Risk];
    const bValue = b[sortField as keyof Risk];
    
    if (sortDirection === 'asc') {
      return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
    } else {
      return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
    }
  });

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const riskStats = {
    total: risks.length,
    critical: risks.filter(r => r.risk_score > 20).length,
    high: risks.filter(r => r.risk_score > 12 && r.risk_score <= 20).length,
    medium: risks.filter(r => r.risk_score > 5 && r.risk_score <= 12).length,
    low: risks.filter(r => r.risk_score <= 5).length,
    open: risks.filter(r => !['closed', 'mitigated'].includes(r.status)).length,
    avgScore: risks.length > 0 ? Math.round(risks.reduce((sum, r) => sum + r.risk_score, 0) / risks.length) : 0
  };

  if (loading && risks.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading risk data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Risk Management</h1>
          <p className="text-gray-600">Identify, assess, and mitigate organizational risks</p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add Risk</span>
          </button>
          <button className="flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
            <Download className="w-4 h-4" />
            <span>Export</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-2">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <span className="text-red-700 text-sm">{error}</span>
        </div>
      )}

      {/* Statistics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Risks</p>
              <p className="text-2xl font-bold text-gray-900">{riskStats.total}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-blue-500" />
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Critical</p>
              <p className="text-2xl font-bold text-red-600">{riskStats.critical}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">High</p>
              <p className="text-2xl font-bold text-orange-600">{riskStats.high}</p>
            </div>
            <TrendingUp className="w-8 h-8 text-orange-500" />
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Medium</p>
              <p className="text-2xl font-bold text-yellow-600">{riskStats.medium}</p>
            </div>
            <Activity className="w-8 h-8 text-yellow-500" />
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Low</p>
              <p className="text-2xl font-bold text-green-600">{riskStats.low}</p>
            </div>
            <TrendingDown className="w-8 h-8 text-green-500" />
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Open</p>
              <p className="text-2xl font-bold text-blue-600">{riskStats.open}</p>
            </div>
            <Clock className="w-8 h-8 text-blue-500" />
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Avg Score</p>
              <p className="text-2xl font-bold text-purple-600">{riskStats.avgScore}</p>
            </div>
            <Activity className="w-8 h-8 text-purple-500" />
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
          <div className="flex flex-col sm:flex-row sm:items-center space-y-4 sm:space-y-0 sm:space-x-4">
            <div className="relative">
              <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search risks..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Categories</option>
              <option value="operational">Operational</option>
              <option value="financial">Financial</option>
              <option value="strategic">Strategic</option>
              <option value="compliance">Compliance</option>
              <option value="security">Security</option>
              <option value="technical">Technical</option>
              <option value="environmental">Environmental</option>
              <option value="reputational">Reputational</option>
            </select>
            
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="identified">Identified</option>
              <option value="assessed">Assessed</option>
              <option value="mitigated">Mitigated</option>
              <option value="monitoring">Monitoring</option>
              <option value="closed">Closed</option>
            </select>
            
            <select
              value={filterRiskLevel}
              onChange={(e) => setFilterRiskLevel(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Risk Levels</option>
              <option value="low">Low (1-5)</option>
              <option value="medium">Medium (6-12)</option>
              <option value="high">High (13-20)</option>
              <option value="critical">Critical (21-25)</option>
            </select>
          </div>
          
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">
              Showing {sortedRisks.length} of {risks.length} risks
            </span>
          </div>
        </div>
      </div>

      {/* Risks Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('title')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Risk</span>
                    {sortField === 'title' && (
                      sortDirection === 'asc' ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                    )}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('category')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Category</span>
                    {sortField === 'category' && (
                      sortDirection === 'asc' ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                    )}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('risk_score')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Risk Score</span>
                    {sortField === 'risk_score' && (
                      sortDirection === 'asc' ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                    )}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('status')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Status</span>
                    {sortField === 'status' && (
                      sortDirection === 'asc' ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                    )}
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Owner
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Due Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedRisks.map((risk) => (
                <tr key={risk.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-red-600 rounded-lg flex items-center justify-center">
                        <AlertTriangle className="w-5 h-5 text-white" />
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">{risk.title}</div>
                        <div className="text-sm text-gray-500 truncate max-w-xs">{risk.description}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-700 capitalize">
                      {risk.category}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full border ${getRiskLevelColor(risk.risk_score)}`}>
                        {risk.risk_score}
                      </span>
                      <span className="text-xs text-gray-500">{getRiskLevel(risk.risk_score)}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {getStatusIcon(risk.status)}
                      <span className={`ml-2 inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(risk.status)}`}>
                        {risk.status.charAt(0).toUpperCase() + risk.status.slice(1)}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center text-sm text-gray-900">
                      <User className="w-4 h-4 mr-1 text-gray-400" />
                      {risk.department || 'Unassigned'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {risk.due_date ? new Date(risk.due_date).toLocaleDateString() : 'No due date'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setSelectedRisk(risk)}
                        className="text-blue-600 hover:text-blue-900"
                        title="View details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      {hasPermission('risks.update') && (
                        <button
                          onClick={() => openEditForm(risk)}
                          className="text-gray-600 hover:text-gray-900"
                          title="Edit risk"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                      )}
                      {hasPermission('risks.delete') && (
                        <button
                          onClick={() => handleDeleteRisk(risk.id, risk.title)}
                          className="text-red-600 hover:text-red-900"
                          title="Delete risk"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Risk Form Modal */}
      {showAddForm && (
        <AddEditRiskForm
          onClose={() => setShowAddForm(false)}
          onSubmit={handleCreateRisk}
        />
      )}

      {/* Edit Risk Form Modal */}
      {showEditForm && editingRisk && (
        <AddEditRiskForm
          onClose={() => {
            setShowEditForm(false);
            setEditingRisk(null);
          }}
          onSubmit={handleUpdateRisk}
          riskToEdit={editingRisk}
        />
      )}

      {/* Risk Detail Modal */}
      {selectedRisk && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-16 h-16 bg-red-600 rounded-lg flex items-center justify-center">
                    <AlertTriangle className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">{selectedRisk.title}</h2>
                    <div className="flex items-center space-x-2 mt-1">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full border ${getRiskLevelColor(selectedRisk.risk_score)}`}>
                        Risk Score: {selectedRisk.risk_score}
                      </span>
                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-700 capitalize">
                        {selectedRisk.category}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {hasPermission('risks.delete') && (
                    <button
                      onClick={() => {
                        handleDeleteRisk(selectedRisk.id, selectedRisk.title);
                        setSelectedRisk(null);
                      }}
                      className="p-2 text-red-600 hover:text-red-800 transition-colors"
                      title="Delete risk"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  )}
                  <button
                    onClick={() => setSelectedRisk(null)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>
            </div>
            
            <div className="p-6 space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Description</h3>
                <p className="text-gray-700">{selectedRisk.description}</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Risk Details</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-500">Status</span>
                      <div className="flex items-center">
                        {getStatusIcon(selectedRisk.status)}
                        <span className={`ml-2 inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(selectedRisk.status)}`}>
                          {selectedRisk.status.charAt(0).toUpperCase() + selectedRisk.status.slice(1)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-500">Impact</span>
                      <span className="text-sm text-gray-900 capitalize">{selectedRisk.impact.replace('_', ' ')}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-500">Likelihood</span>
                      <span className="text-sm text-gray-900 capitalize">{selectedRisk.likelihood.replace('_', ' ')}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-500">Department</span>
                      <span className="text-sm text-gray-900">{selectedRisk.department || 'Not assigned'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-500">Due Date</span>
                      <span className="text-sm text-gray-900">
                        {selectedRisk.due_date ? new Date(selectedRisk.due_date).toLocaleDateString() : 'No due date'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-500">Last Reviewed</span>
                      <span className="text-sm text-gray-900">
                        {selectedRisk.last_reviewed_at ? new Date(selectedRisk.last_reviewed_at).toLocaleDateString() : 'Never'}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Mitigation Plan</h3>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-gray-700">
                      {selectedRisk.mitigation_plan || 'No mitigation plan specified'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RiskManagement;